import { Queue, QueueOptions, JobsOptions } from 'bullmq';
import { Redis, RedisOptions } from 'ioredis';
import { config } from '../config/env.config.js';
import { Logger } from '../utils/logger.js';

import { getCorrelationId } from '../middleware/correlation.middleware.js';

export type QueueName = 'ocr' | 'extraction' | 'webhook' | 'email-intake' | 'maintenance';

export interface OcrJobData {
  eventId: string;
  documentId: string;
  tenantId: string;
  storagePath: string;
  mimeType: string;
  fileName: string;
  documentType: string;
  isRetry?: boolean;
  correlationId?: string;
}

export interface ExtractionJobData {
  eventId: string;
  documentId: string;
  tenantId: string;
  documentType: string;
  correlationId?: string;
}

export interface WebhookJobData {
  eventId: string;
  subscriptionId: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, any>;
  correlationId?: string;
}

export class QueueService {
  private static redisClient: Redis | null = null;
  private static queues: Map<QueueName, Queue> = new Map();
  private static inMemoryJobs: Map<string, any[]> = new Map();
  private static mode: 'redis' | 'memory' = process.env['NODE_ENV'] === 'test' ? 'memory' : 'redis';

  static setMode(mode: 'redis' | 'memory'): void {
    this.mode = mode;
  }

  static getMode(): 'redis' | 'memory' {
    return this.mode;
  }

  static clearInMemory(): void {
    this.inMemoryJobs.clear();
  }

  static getInMemoryJobs(queueName: QueueName): any[] {
    return this.inMemoryJobs.get(queueName) || [];
  }

  static getRedisClient(): Redis {
    if (!this.redisClient) {
      const redisOptions: RedisOptions = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (this.mode === 'memory') return null;
          return Math.min(times * 100, 3000);
        },
      };

      if (config.redis.url) {
        this.redisClient = new Redis(config.redis.url, redisOptions);
      } else {
        this.redisClient = new Redis(redisOptions);
      }

      this.redisClient.on('error', (err) => {
        Logger.warn({
          message: `Redis connection error: ${err.message}`,
          context: 'QueueService',
        });
      });
    }

    return this.redisClient;
  }

  private static getDefaultJobOptions(jobId?: string): JobsOptions {
    return {
      jobId,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for inspection and dead-letter visibility
    };
  }

  static getQueue(name: QueueName): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queueOptions: QueueOptions = {
      prefix: config.redis.queuePrefix,
      connection: this.getRedisClient(),
    };

    const queue = new Queue(name, queueOptions);
    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Enqueues an OCR job idempotently using deterministic jobId.
   */
  static async enqueueOcr(data: OcrJobData, eventId?: string): Promise<string> {
    data.correlationId = data.correlationId || (getCorrelationId() !== 'N/A' ? getCorrelationId() : undefined);
    const jobId = eventId ? `outbox-${eventId}` : `ocr-${data.documentId}-${Date.now()}`;

    if (this.mode === 'memory') {
      const list = this.inMemoryJobs.get('ocr') || [];
      // Idempotency check: don't duplicate if jobId exists
      if (!list.some((j) => j.id === jobId)) {
        list.push({ id: jobId, name: 'process-ocr', data });
        this.inMemoryJobs.set('ocr', list);
      }
      return jobId;
    }

    try {
      const queue = this.getQueue('ocr');
      const job = await queue.add('process-ocr', data, this.getDefaultJobOptions(jobId));
      return job.id || jobId;
    } catch (err: any) {
      Logger.error({
        message: `Failed to enqueue OCR job to Redis: ${err.message}`,
        context: 'QueueService',
        error: err,
        data: { documentId: data.documentId },
      });
      throw err;
    }
  }

  /**
   * Enqueues an extraction job idempotently.
   */
  static async enqueueExtraction(data: ExtractionJobData, eventId?: string): Promise<string> {
    data.correlationId = data.correlationId || (getCorrelationId() !== 'N/A' ? getCorrelationId() : undefined);
    const jobId = eventId ? `outbox-${eventId}` : `extract-${data.documentId}-${Date.now()}`;

    if (this.mode === 'memory') {
      const list = this.inMemoryJobs.get('extraction') || [];
      if (!list.some((j) => j.id === jobId)) {
        list.push({ id: jobId, name: 'process-extraction', data });
        this.inMemoryJobs.set('extraction', list);
      }
      return jobId;
    }

    try {
      const queue = this.getQueue('extraction');
      const job = await queue.add('process-extraction', data, this.getDefaultJobOptions(jobId));
      return job.id || jobId;
    } catch (err: any) {
      Logger.error({
        message: `Failed to enqueue extraction job to Redis: ${err.message}`,
        context: 'QueueService',
        error: err,
        data: { documentId: data.documentId },
      });
      throw err;
    }
  }

  /**
   * Enqueues a webhook job idempotently.
   */
  static async enqueueWebhook(data: WebhookJobData, eventId?: string): Promise<string> {
    data.correlationId = data.correlationId || (getCorrelationId() !== 'N/A' ? getCorrelationId() : undefined);
    const jobId = eventId ? `outbox-${eventId}` : `webhook-${data.subscriptionId}-${Date.now()}`;

    if (this.mode === 'memory') {
      const list = this.inMemoryJobs.get('webhook') || [];
      if (!list.some((j) => j.id === jobId)) {
        list.push({ id: jobId, name: 'dispatch-webhook', data });
        this.inMemoryJobs.set('webhook', list);
      }
      return jobId;
    }

    try {
      const queue = this.getQueue('webhook');
      const job = await queue.add('dispatch-webhook', data, this.getDefaultJobOptions(jobId));
      return job.id || jobId;
    } catch (err: any) {
      Logger.error({
        message: `Failed to enqueue webhook job to Redis: ${err.message}`,
        context: 'QueueService',
        error: err,
        data: { subscriptionId: data.subscriptionId },
      });
      throw err;
    }
  }

  /**
   * Schedules a BullMQ repeatable job for email intake mailbox polling (every 60s)
   */
  static async scheduleRepeatableEmailIntake(intervalSeconds = 60): Promise<void> {
    if (this.mode === 'memory') {
      const list = this.inMemoryJobs.get('email-intake') || [];
      list.push({ id: 'repeatable-email-poll', name: 'poll-mailboxes', data: { intervalSeconds } });
      this.inMemoryJobs.set('email-intake', list);
      return;
    }

    try {
      const queue = this.getQueue('email-intake');
      await queue.add(
        'poll-mailboxes',
        {},
        {
          repeat: { every: intervalSeconds * 1000 },
          removeOnComplete: true,
          removeOnFail: 100,
        } as any
      );
      Logger.info({
        message: `Repeatable email intake job scheduled (every ${intervalSeconds}s)`,
        context: 'QueueService',
      });
    } catch (err: any) {
      Logger.warn({
        message: `Failed to schedule repeatable email intake job: ${err.message}`,
        context: 'QueueService',
      });
    }
  }

  /**
   * Schedules a repeatable BullMQ job for idempotency key cleanup (B.3)
   */
  static async scheduleRepeatableIdempotencyCleanup(intervalHours = 1): Promise<void> {
    if (this.mode === 'memory') {
      const list = this.inMemoryJobs.get('maintenance') || [];
      list.push({ id: 'repeatable-idempotency-cleanup', name: 'cleanup-idempotency', data: { intervalHours } });
      this.inMemoryJobs.set('maintenance', list);
      return;
    }

    try {
      const queue = this.getQueue('maintenance');
      await queue.add(
        'cleanup-idempotency',
        {},
        {
          repeat: { every: intervalHours * 60 * 60 * 1000 },
          removeOnComplete: true,
          removeOnFail: 100,
        } as any
      );
      Logger.info({
        message: `Repeatable idempotency cleanup job scheduled (every ${intervalHours}h)`,
        context: 'QueueService',
      });
    } catch (err: any) {
      Logger.warn({
        message: `Failed to schedule repeatable idempotency cleanup job: ${err.message}`,
        context: 'QueueService',
      });
    }
  }

  /**
   * Schedules a daily repeatable BullMQ job for document expiry notifications (D.3)
   */
  static async scheduleRepeatableExpiryNotifications(): Promise<void> {
    if (this.mode === 'memory') {
      const list = this.inMemoryJobs.get('maintenance') || [];
      list.push({ id: 'repeatable-expiry-notifications', name: 'check-expiries', data: {} });
      this.inMemoryJobs.set('maintenance', list);
      return;
    }

    try {
      const queue = this.getQueue('maintenance');
      await queue.add(
        'check-expiries',
        {},
        {
          repeat: { pattern: '0 0 * * *' }, // Daily at midnight
          removeOnComplete: true,
          removeOnFail: 100,
        } as any
      );
      Logger.info({
        message: 'Repeatable daily document expiry notification job scheduled',
        context: 'QueueService',
      });
    } catch (err: any) {
      Logger.warn({
        message: `Failed to schedule repeatable document expiry notification job: ${err.message}`,
        context: 'QueueService',
      });
    }
  }

  /**
   * Graceful shutdown of all queue connections
   */
  static async closeAll(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
      } catch (err: any) {
        Logger.warn({
          message: `Error closing queue ${name}: ${err.message}`,
          context: 'QueueService',
        });
      }
    }
    this.queues.clear();

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {}
      this.redisClient = null;
    }
  }
}
