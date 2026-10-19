import crypto from 'crypto';
import { dbPool } from '../database/postgres.client.js';
import { config } from '../config/env.config.js';
import { Logger } from '../utils/logger.js';
import { getCorrelationId } from '../middleware/correlation.middleware.js';

export interface AuditTrailRecord {
  eventId: string;
  tenantId: string;
  documentId?: string | null;
  userId?: string | null;
  action: string;
  details: Record<string, any>;
  ipAddress?: string | null;
  sha256Signature: string;
  correlationId?: string | null;
  createdAt: Date;
}

export class AuditTrailService {
  private static inMemoryEvents: AuditTrailRecord[] = [];

  static clearInMemory(): void {
    this.inMemoryEvents = [];
  }

  static async recordEvent(params: {
    tenantId: string;
    action: string;
    userId?: string | null;
    documentId?: string | null;
    details?: Record<string, any>;
    ipAddress?: string | null;
    correlationId?: string | null;
  }): Promise<AuditTrailRecord> {
    const eventId = crypto.randomUUID();
    const correlationId = params.correlationId || (getCorrelationId() !== 'N/A' ? getCorrelationId() : null);
    const details = params.details || {};
    const ipAddress = params.ipAddress || '127.0.0.1';

    // Canonical HMAC-SHA256 signature payload
    const signPayload = JSON.stringify({
      action: params.action,
      tenantId: params.tenantId,
      documentId: params.documentId || null,
      userId: params.userId || null,
      details,
      correlationId,
    });

    const hmacSecret = config.audit.hmacSecret;
    const sha256Signature = crypto.createHmac('sha256', hmacSecret).update(signPayload).digest('hex');

    const record: AuditTrailRecord = {
      eventId,
      tenantId: params.tenantId,
      documentId: params.documentId || null,
      userId: params.userId || null,
      action: params.action,
      details,
      ipAddress,
      sha256Signature,
      correlationId,
      createdAt: new Date(),
    };

    try {
      await dbPool.query(
        `INSERT INTO audit_trail_events (
          event_id, tenant_id, document_id, user_id, action, details, ip_address, sha256_signature, correlation_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.eventId,
          record.tenantId,
          record.documentId,
          record.userId,
          record.action,
          JSON.stringify(record.details),
          record.ipAddress,
          record.sha256Signature,
          record.correlationId,
          record.createdAt,
        ]
      );
    } catch (err: any) {
      Logger.warn({
        message: `Failed to insert into audit_trail_events: ${err.message}`,
        context: 'AuditTrailService',
      });
    }

    this.inMemoryEvents.push(record);
    return record;
  }

  static async queryAuditTrail(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ total: number; events: any[] }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    try {
      const countRes = await dbPool.query(
        'SELECT count(*)::int as count FROM audit_trail_events WHERE tenant_id = $1',
        [tenantId]
      );
      const total = countRes.rows[0]?.count || 0;

      const res = await dbPool.query(
        `SELECT event_id as id, TO_CHAR(created_at, 'DD Mon YYYY HH24:MI') as timestamp, user_id as actor,
                'User' as role, action, COALESCE(document_id, 'SYSTEM') as resource, 'SUCCESS' as status
         FROM audit_trail_events
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      );
      return { total, events: res.rows };
    } catch {
      const tenantEvents = this.inMemoryEvents.filter((e) => e.tenantId === tenantId);
      const total = tenantEvents.length;
      const sliced = tenantEvents.slice(offset, offset + limit).map((e) => ({
        id: e.eventId,
        timestamp: new Date(e.createdAt).toISOString(),
        actor: e.userId || 'system',
        role: 'User',
        action: e.action,
        resource: e.documentId || 'SYSTEM',
        status: 'SUCCESS',
      }));
      return { total, events: sliced };
    }
  }

  static async findByCorrelationId(tenantId: string, correlationId: string): Promise<AuditTrailRecord[]> {
    try {
      const res = await dbPool.query(
        `SELECT event_id as "eventId", tenant_id as "tenantId", document_id as "documentId",
                user_id as "userId", action, details, ip_address as "ipAddress",
                sha256_signature as "sha256Signature", correlation_id as "correlationId",
                created_at as "createdAt"
         FROM audit_trail_events
         WHERE tenant_id = $1 AND correlation_id = $2
         ORDER BY created_at DESC`,
        [tenantId, correlationId]
      );
      if (res.rows.length > 0) return res.rows;
    } catch {}

    return this.inMemoryEvents.filter(
      (e) => e.tenantId === tenantId && e.correlationId === correlationId
    );
  }
}
