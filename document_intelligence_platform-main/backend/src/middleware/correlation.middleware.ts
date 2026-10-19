import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface CorrelationContext {
  correlationId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Returns the active correlation ID in the current async context,
 * or 'N/A' if called outside an active request/job context.
 */
export function getCorrelationId(): string {
  const store = correlationStorage.getStore();
  return store?.correlationId || 'N/A';
}

/**
 * Runs a function or async block within an explicit correlation ID context.
 * Used by BullMQ worker processors and scheduled tasks.
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  const validId = isValidCorrelationId(correlationId) ? correlationId : crypto.randomUUID();
  return correlationStorage.run({ correlationId: validId }, fn);
}

const CORRELATION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidCorrelationId(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.trim().length <= 64 && CORRELATION_ID_REGEX.test(val.trim());
}

/**
 * AsyncLocalStorage correlation middleware registered first in Express pipeline.
 * Validates format and length of X-Correlation-Id header, otherwise generates a UUID.
 * Returns X-Correlation-Id in the response header and propagates context downstream.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-correlation-id'];
  let correlationId: string;

  if (isValidCorrelationId(incoming)) {
    correlationId = incoming.trim();
  } else {
    correlationId = crypto.randomUUID();
  }

  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  correlationStorage.run({ correlationId }, () => {
    next();
  });
}
