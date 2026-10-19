import crypto from 'crypto';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

export interface IdempotencyRecord {
  tenantId: string;
  userId: string;
  key: string;
  requestHash: string;
  status: 'in_progress' | 'completed';
  responseStatus?: number | null;
  responseBody?: any;
  createdAt: Date;
  expiresAt: Date;
}

const SECRET_FIELDS = [
  'token',
  'invitetoken',
  'invitationtoken',
  'recoverycodes',
  'secret',
  'mfaenckey',
  'totpsecret',
  'qrcodeurl',
  'otpauth',
  'password',
  'passwordhash',
];

/**
 * Recursively sanitize response payloads to ensure sensitive tokens and
 * MFA recovery codes are never durably stored in idempotency cache.
 */
export function sanitizeIdempotencyResponse(body: any): any {
  if (body === null || body === undefined) return body;

  if (Array.isArray(body)) {
    return body.map((item) => sanitizeIdempotencyResponse(item));
  }

  if (typeof body === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(body)) {
      const lower = key.toLowerCase();
      if (SECRET_FIELDS.some((s) => lower.includes(s))) {
        sanitized[key] = '[REDACTED_SECRET_OMITTED_FROM_IDEMPOTENCY_STORE]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = sanitizeIdempotencyResponse(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  return body;
}

export function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = sortKeys(obj[k]);
  }
  return sorted;
}

export class IdempotencyService {
  private static inMemoryStore = new Map<string, IdempotencyRecord>();

  static clearInMemory(): void {
    this.inMemoryStore.clear();
  }

  static getStoreKey(tenantId: string, userId: string, key: string): string {
    return `${tenantId}:${userId}:${key}`;
  }

  static computeRequestHash(body: any, fileSha256?: string): string {
    const hasher = crypto.createHash('sha256');
    if (fileSha256) {
      hasher.update(`file:${fileSha256}`);
    }
    const normalizedBody = JSON.stringify(sortKeys(body || {}));
    hasher.update(`body:${normalizedBody}`);
    return hasher.digest('hex');
  }

  static async findRecord(tenantId: string, userId: string, key: string): Promise<IdempotencyRecord | null> {
    try {
      const res = await dbPool.query(
        `SELECT tenant_id as "tenantId", user_id as "userId", key, request_hash as "requestHash",
                status, response_status as "responseStatus", response_body as "responseBody",
                created_at as "createdAt", expires_at as "expiresAt"
         FROM idempotency_keys
         WHERE tenant_id = $1 AND user_id = $2 AND key = $3
         LIMIT 1`,
        [tenantId, userId, key]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {}

    const memKey = this.getStoreKey(tenantId, userId, key);
    return this.inMemoryStore.get(memKey) || null;
  }

  static async createInProgressRecord(
    tenantId: string,
    userId: string,
    key: string,
    requestHash: string,
    ttlHours = 24
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const record: IdempotencyRecord = {
      tenantId,
      userId,
      key,
      requestHash,
      status: 'in_progress',
      createdAt: new Date(),
      expiresAt,
    };

    try {
      const res = await dbPool.query(
        `INSERT INTO idempotency_keys (
          tenant_id, user_id, key, request_hash, status, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, 'in_progress', NOW(), $5)
        ON CONFLICT (tenant_id, user_id, key) DO NOTHING
        RETURNING tenant_id`,
        [tenantId, userId, key, requestHash, expiresAt]
      );
      if ((res.rowCount ?? 0) > 0) {
        this.inMemoryStore.set(this.getStoreKey(tenantId, userId, key), record);
        return true;
      }
      return false;
    } catch {
      const memKey = this.getStoreKey(tenantId, userId, key);
      if (this.inMemoryStore.has(memKey)) {
        return false;
      }
      this.inMemoryStore.set(memKey, record);
      return true;
    }
  }

  static async completeRecord(
    tenantId: string,
    userId: string,
    key: string,
    responseStatus: number,
    responseBody: any
  ): Promise<void> {
    const sanitizedBody = sanitizeIdempotencyResponse(responseBody);
    try {
      await dbPool.query(
        `UPDATE idempotency_keys
         SET status = 'completed', response_status = $1, response_body = $2
         WHERE tenant_id = $3 AND user_id = $4 AND key = $5`,
        [responseStatus, JSON.stringify(sanitizedBody), tenantId, userId, key]
      );
    } catch {}

    const memKey = this.getStoreKey(tenantId, userId, key);
    const existing = this.inMemoryStore.get(memKey);
    if (existing) {
      existing.status = 'completed';
      existing.responseStatus = responseStatus;
      existing.responseBody = sanitizedBody;
    }
  }

  static async removeRecord(tenantId: string, userId: string, key: string): Promise<void> {
    try {
      await dbPool.query(
        `DELETE FROM idempotency_keys WHERE tenant_id = $1 AND user_id = $2 AND key = $3`,
        [tenantId, userId, key]
      );
    } catch {}

    this.inMemoryStore.delete(this.getStoreKey(tenantId, userId, key));
  }

  static async cleanupExpired(): Promise<number> {
    try {
      const res = await dbPool.query(`DELETE FROM idempotency_keys WHERE expires_at <= NOW()`);
      return res.rowCount ?? 0;
    } catch {
      let count = 0;
      const now = new Date();
      for (const [k, v] of this.inMemoryStore.entries()) {
        if (v.expiresAt <= now) {
          this.inMemoryStore.delete(k);
          count++;
        }
      }
      return count;
    }
  }
}
