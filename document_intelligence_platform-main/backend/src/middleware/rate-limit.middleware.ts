import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { config } from '../config/env.config.js';
import { dbPool } from '../database/postgres.client.js';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Interface for rate limit storage adapters.
 * In a distributed, multi-instance deployment (e.g. Kubernetes, multiple Node.js replicas),
 * an external distributed store like Redis (using atomic INCR/EXPIRE) or PostgreSQL (using atomic upsert)
 * must be used instead of in-memory maps to ensure cluster-wide limit enforcement.
 */
export interface IRateLimiterStore {
  get(key: string, windowMs: number): Promise<RateLimitRecord> | RateLimitRecord;
  reset?(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

/**
 * In-memory rate limit store for single-instance / test environments.
 */
export class RateLimiterStore implements IRateLimiterStore {
  private hits: Map<string, RateLimitRecord> = new Map();

  get(key: string, windowMs: number): RateLimitRecord {
    const now = Date.now();
    const existing = this.hits.get(key);

    if (!existing || now > existing.resetTime) {
      const record = { count: 1, resetTime: now + windowMs };
      this.hits.set(key, record);
      return record;
    }

    existing.count += 1;
    return existing;
  }

  has(key: string): boolean {
    const existing = this.hits.get(key);
    if (!existing) return false;
    if (Date.now() > existing.resetTime) {
      this.hits.delete(key);
      return false;
    }
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  clear(): void {
    this.hits.clear();
  }
}

/**
 * Production-ready PostgreSQL Distributed Rate Limiting Store.
 * Provides atomic, cross-instance concurrency enforcement using atomic upsert:
 * INSERT ... ON CONFLICT (key) DO UPDATE SET count = ..., reset_time = ... RETURNING count, reset_time
 */
export class PostgresRateLimiterStore implements IRateLimiterStore {
  private pool: any;
  private fallbackStore: RateLimiterStore;
  private pruneCounter: number = 0;

  constructor(pool: any = dbPool, fallbackStore: RateLimiterStore = new RateLimiterStore()) {
    this.pool = pool;
    this.fallbackStore = fallbackStore;
  }

  async get(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now();
    const resetTime = now + windowMs;

    try {
      const query = `
        INSERT INTO rate_limit_entries (key, count, reset_time, updated_at)
        VALUES ($1, 1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET
          count = CASE
            WHEN rate_limit_entries.reset_time < $3 THEN 1
            ELSE rate_limit_entries.count + 1
          END,
          reset_time = CASE
            WHEN rate_limit_entries.reset_time < $3 THEN $2
            ELSE rate_limit_entries.reset_time
          END,
          updated_at = CURRENT_TIMESTAMP
        RETURNING count, reset_time;
      `;

      const res = await this.pool.query(query, [key, resetTime, now]);
      const row = res.rows[0];

      // Periodic non-blocking cleanup of expired windows (every 100 requests)
      this.pruneCounter++;
      if (this.pruneCounter % 100 === 0) {
        this.pool.query('DELETE FROM rate_limit_entries WHERE reset_time < $1', [now]).catch(() => {});
      }

      return {
        count: parseInt(row.count, 10),
        resetTime: parseInt(row.reset_time, 10),
      };
    } catch (err: any) {
      Logger.warn({
        message: 'PostgresRateLimiterStore database query failed; falling back to process-local memory store',
        context: 'RateLimiter',
        data: { error: err.message },
      });
      return this.fallbackStore.get(key, windowMs);
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM rate_limit_entries WHERE key = $1', [key]);
    } catch {
      this.fallbackStore.reset(key);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.pool.query('DELETE FROM rate_limit_entries');
    } catch {
      this.fallbackStore.clear();
    }
  }
}

// Global default store instance based on environment configuration
export const defaultRateLimitStore: IRateLimiterStore =
  config.rateLimit.storeType === 'postgres'
    ? new PostgresRateLimiterStore(dbPool)
    : new RateLimiterStore();

/**
 * Creates configurable Rate Limiting Middleware adhering to RFC-7807 problem details.
 *
 * Reverse Proxy Trust Notice:
 * Express req.ip is utilized by default. If the application is deployed behind reverse proxies
 * (e.g., NGINX, AWS ALB, Cloudflare), `trust proxy` must be explicitly configured in Express
 * (`app.set('trust proxy', countOrSubnet)`) to prevent client IP spoofing via unverified headers.
 * Raw X-Forwarded-For headers are never blindly trusted without Express proxy validation.
 */
export function createRateLimiter(options: RateLimitOptions, store: IRateLimiterStore = defaultRateLimitStore) {
  const {
    windowMs,
    max,
    message = 'Too many login attempts. Please try again later.',
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown-client',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientKey = keyGenerator(req);
      const { count, resetTime } = await store.get(clientKey, windowMs);
      const remaining = Math.max(0, max - count);
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));

      // Standard RFC/IETF RateLimit Headers
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', retryAfterSeconds);

      if (count > max) {
        res.setHeader('Retry-After', retryAfterSeconds);

        const correlationId = (req.headers['x-correlation-id'] as string) || 'N/A';
        // Note: clientKey (IP) is logged, but NEVER passwords, tokens, or request bodies
        Logger.warn({
          message: 'Rate limit exceeded on authentication endpoint',
          context: 'RateLimiter',
          correlationId,
          data: { clientKey, attemptCount: count, maxAllowed: max },
        });

        res.status(429).json({
          type: 'https://api.docunexa.enterprise/errors/RATE_LIMIT_EXCEEDED',
          title: message,
          status: 429,
          detail: `Exceeded ${max} requests in ${windowMs / 1000} seconds. Retry after ${retryAfterSeconds} seconds.`,
          instance: req.originalUrl,
          correlationId,
        });
        return;
      }

      next();
    } catch (err) {
      // In case of rate limiter store failure, pass through to avoid locking out legitimate users
      Logger.error({
        message: 'Rate limiter store error (fail-open executed)',
        context: 'RateLimiter',
        data: { error: (err as Error).message },
      });
      next();
    }
  };
}

// Pre-configured login rate limiter driven by environment configuration
export const loginRateLimiter = createRateLimiter({
  windowMs: config.rateLimit?.authWindowMs || 60 * 1000,
  max: config.rateLimit?.authMaxAttempts || 5,
  message: 'Too many login attempts from this IP. Please try again after 60 seconds.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again after 60 seconds.',
});

export const acceptInviteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many invitation acceptance attempts. Please try again later.',
});

export const mfaRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many MFA verification attempts. Please try again later.',
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Document upload rate limit exceeded. Please throttle ingestion submissions.',
});

export const exportRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Export rate limit exceeded. Please wait before requesting another export.',
});

