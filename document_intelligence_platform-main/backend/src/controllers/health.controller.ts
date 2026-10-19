import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../database/postgres.client.js';
import { checkMongoHealth } from '../database/mongo.client.js';
import { MetricsService } from '../services/metrics.service.js';
import { StorageFactory } from '../services/storage.service.js';
import { ScannerFactory } from '../services/scanner.service.js';
import { config } from '../config/env.config.js';
import { QueueService } from '../services/queue.service.js';

export async function getLiveness(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'UP',
    service: 'docunexa-backend',
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  // 1. Postgres Check
  const isDbHealthy = await checkDatabaseHealth();

  // 2. Redis Check
  let redisStatus: 'UP' | 'DOWN' | 'DISABLED' = 'UP';
  try {
    if (QueueService.getMode() === 'memory') {
      redisStatus = 'UP';
    } else {
      const redisClient = QueueService.getRedisClient();
      if (redisClient) {
        const pingRes = await redisClient.ping();
        redisStatus = pingRes === 'PONG' ? 'UP' : 'DOWN';
      }
    }
  } catch {
    redisStatus = 'DOWN';
  }

  // 3. Mongo Check
  const mongoStatus = await checkMongoHealth();

  // 4. Storage Driver Check
  let storageStatus: 'UP' | 'DOWN' = 'UP';
  try {
    const storage = StorageFactory.getStorage();
    await storage.hasObject('__healthcheck__');
    storageStatus = 'UP';
  } catch {
    storageStatus = 'DOWN';
  }

  // 5. Malware Scanner Check
  let scannerStatus: 'UP' | 'DOWN' = 'UP';
  try {
    const scanner = ScannerFactory.getScanner();
    const scanRes = await scanner.scanBuffer(Buffer.from('HEALTHCHECK_PROBE'), 'healthcheck.txt');
    scannerStatus = scanRes.clean ? 'UP' : 'DOWN';
  } catch {
    scannerStatus = 'DOWN';
  }

  const isHealthy =
    isDbHealthy &&
    redisStatus === 'UP' &&
    (mongoStatus === 'UP' || mongoStatus === 'DISABLED') &&
    storageStatus === 'UP' &&
    scannerStatus === 'UP';

  const dependencies = {
    postgres: isDbHealthy ? 'UP' : 'DOWN',
    redis: redisStatus,
    mongo: mongoStatus,
    storage: storageStatus,
    scanner: scannerStatus,
  };

  if (!isHealthy) {
    res.status(503).json({
      status: 'DOWN',
      service: 'docunexa-backend',
      dependencies,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    status: 'UP',
    service: 'docunexa-backend',
    dependencies,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /metrics — Prometheus format metrics endpoint (Admin or Internal network only)
 */
export async function getMetrics(req: Request, res: Response): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocalOrInternal =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('192.168.');

  const authUser = (req as any).user;
  const isAdmin = authUser?.role === 'Admin' || authUser?.role === 'org_admin' || authUser?.role === 'platform_operator';

  if (!isLocalOrInternal && !isAdmin && config.env === 'production') {
    res.status(403).json({
      type: 'https://api.docunexa.enterprise/errors/FORBIDDEN',
      title: 'Metrics endpoint is restricted to administrators and internal network callers.',
      status: 403,
      instance: req.originalUrl,
    });
    return;
  }

  const metricsData = await MetricsService.getPrometheusMetrics();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(metricsData);
}
