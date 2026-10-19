import { Worker, WorkerOptions } from 'bullmq';
import { config, validateEnvironment } from './config/env.config.js';
import { QueueService } from './services/queue.service.js';
import { OutboxPollerService } from './services/outbox-poller.service.js';
import { processOcrJob, processExtractionJob, processWebhookJob } from './workers/job-processors.js';
import { dbPool } from './database/postgres.client.js';
import { Logger } from './utils/logger.js';

Logger.info({
  message: 'Starting DocuNexa Dedicated Background Worker Process...',
  context: 'WorkerMain',
});

// Validate environment on worker startup
validateEnvironment();

const connection = QueueService.getRedisClient();

const workerOptions: WorkerOptions = {
  connection,
  concurrency: 3,
  prefix: config.redis.queuePrefix,
};

import { EmailIntakeService } from './services/email-intake.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { NotificationService } from './services/notification.service.js';

// 1. Initialize BullMQ Workers
const ocrWorker = new Worker('ocr', processOcrJob, workerOptions);
const extractionWorker = new Worker('extraction', processExtractionJob, workerOptions);
const webhookWorker = new Worker('webhook', processWebhookJob, workerOptions);
const emailIntakeWorker = new Worker(
  'email-intake',
  async () => {
    Logger.info({ message: 'Executing scheduled email intake polling cycle', context: 'EmailIntakeWorker' });
    await EmailIntakeService.pollMailboxesOnce();
  },
  workerOptions
);
const maintenanceWorker = new Worker(
  'maintenance',
  async (job) => {
    if (job.name === 'cleanup-idempotency') {
      Logger.info({ message: 'Executing scheduled idempotency cleanup job', context: 'MaintenanceWorker' });
      const cleaned = await IdempotencyService.cleanupExpired();
      Logger.info({ message: `Cleaned ${cleaned} expired idempotency keys`, context: 'MaintenanceWorker' });
    } else if (job.name === 'check-expiries') {
      Logger.info({ message: 'Executing scheduled document expiry notification checks', context: 'MaintenanceWorker' });
      const res = await NotificationService.processDocumentExpiryNotifications();
      Logger.info({ message: `Generated ${res.generatedCount} document expiry notifications`, context: 'MaintenanceWorker' });
    }
  },
  workerOptions
);

// Schedule repeatable maintenance and polling jobs
QueueService.scheduleRepeatableEmailIntake(60).catch(() => {});
QueueService.scheduleRepeatableIdempotencyCleanup(1).catch(() => {});
QueueService.scheduleRepeatableExpiryNotifications().catch(() => {});

// Log worker events
for (const worker of [ocrWorker, extractionWorker, webhookWorker, emailIntakeWorker, maintenanceWorker]) {
  worker.on('completed', (job) => {
    Logger.info({
      message: `Job ${job.id} on queue '${worker.name}' completed`,
      context: 'Worker',
      data: { jobId: job.id, queue: worker.name },
    });
  });

  worker.on('failed', (job, err) => {
    Logger.warn({
      message: `Job ${job?.id} on queue '${worker.name}' failed attempt ${job?.attemptsMade}: ${err.message}`,
      context: 'Worker',
      data: { jobId: job?.id, queue: worker.name, attempts: job?.attemptsMade },
    });
  });

  worker.on('error', (err) => {
    Logger.error({
      message: `Worker error on queue '${worker.name}': ${err.message}`,
      context: 'Worker',
      error: err,
    });
  });
}

// 2. Start Transactional Outbox Poller
OutboxPollerService.start(1000);

Logger.info({
  message: 'DocuNexa Worker and Outbox Poller running successfully (Concurrency: 3)',
  context: 'WorkerMain',
});

// 3. Graceful Shutdown Handlers
async function handleShutdown(signal: string) {
  Logger.info({
    message: `Received ${signal}. Shutting down workers gracefully...`,
    context: 'WorkerMain',
  });

  OutboxPollerService.stop();

  try {
    await Promise.all([
      ocrWorker.close(),
      extractionWorker.close(),
      webhookWorker.close(),
      emailIntakeWorker.close(),
      maintenanceWorker.close(),
    ]);
    await QueueService.closeAll();
    await dbPool.end();
    Logger.info({
      message: 'Worker shutdown complete.',
      context: 'WorkerMain',
    });

    process.exit(0);
  } catch (err: any) {
    Logger.error({
      message: `Error during worker shutdown: ${err.message}`,
      context: 'WorkerMain',
      error: err,
    });
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
