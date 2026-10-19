import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { IdempotencyService } from '../services/idempotency.service.js';
import { Logger } from '../utils/logger.js';

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply to state-modifying requests
  if (req.method !== 'POST') {
    return next();
  }

  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
    return next();
  }

  const idempotencyKey = rawKey.trim();
  const user = (req as any).user;
  const tenantId = user?.tenantId || (req.headers['x-tenant-id'] as string) || 'default-tenant';
  const userId = user?.userId || 'anonymous-user';

  // Compute request hash
  let fileSha256: string | undefined;
  if ((req as any).file && (req as any).file.buffer) {
    fileSha256 = crypto.createHash('sha256').update((req as any).file.buffer).digest('hex');
  }

  const requestHash = IdempotencyService.computeRequestHash(req.body, fileSha256);

  (async () => {
    try {
      const existing = await IdempotencyService.findRecord(tenantId, userId, idempotencyKey);
      if (existing) {
        if (existing.status === 'in_progress') {
          return res.status(409).json({
            type: 'https://api.docunexa.enterprise/errors/IDEMPOTENCY_CONFLICT',
            title: 'Conflict: A request with this Idempotency-Key is currently in progress.',
            status: 409,
            detail: 'Please wait for the concurrent request to complete before retrying.',
            instance: req.originalUrl,
          });
        }

        if (existing.status === 'completed') {
          if (existing.requestHash !== requestHash) {
            return res.status(422).json({
              type: 'https://api.docunexa.enterprise/errors/IDEMPOTENCY_PAYLOAD_MISMATCH',
              title: 'Unprocessable Entity: Idempotency Key Reused with Different Payload.',
              status: 422,
              detail: 'The provided Idempotency-Key was already used with a different request payload.',
              instance: req.originalUrl,
            });
          }

          // Return cached response replay
          res.setHeader('Idempotent-Replay', 'true');
          return res.status(existing.responseStatus || 200).json(existing.responseBody);
        }
      }

      // Claim key as in_progress
      const claimed = await IdempotencyService.createInProgressRecord(tenantId, userId, idempotencyKey, requestHash);
      if (!claimed) {
        return res.status(409).json({
          type: 'https://api.docunexa.enterprise/errors/IDEMPOTENCY_CONFLICT',
          title: 'Conflict: Concurrent request detected with identical Idempotency-Key.',
          status: 409,
          detail: 'Another request claimed this key concurrently.',
          instance: req.originalUrl,
        });
      }

      // Intercept response to store completed outcome
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      let capturedBody: any = null;

      res.json = (body: any) => {
        capturedBody = body;
        return originalJson(body);
      };

      res.send = (body: any) => {
        if (!capturedBody) {
          try {
            capturedBody = typeof body === 'string' ? JSON.parse(body) : body;
          } catch {
            capturedBody = { message: String(body) };
          }
        }
        return originalSend(body);
      };

      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          IdempotencyService.completeRecord(tenantId, userId, idempotencyKey, res.statusCode, capturedBody).catch((err) => {
            Logger.warn({ message: `Failed to complete idempotency record: ${err.message}` });
          });
        } else {
          // If server error occurred, release key so client can retry safely
          IdempotencyService.removeRecord(tenantId, userId, idempotencyKey).catch(() => {});
        }
      });

      next();
    } catch (err: any) {
      Logger.error({
        message: `Idempotency middleware error: ${err.message}`,
        error: err,
      });
      next(err);
    }
  })();
}
