import { dbPool } from '../database/postgres.client.js';
import { OutboxService } from './outbox.service.js';
import { QueueService } from './queue.service.js';
import { OutboxEventRecord } from '../models/outbox.models.js';
import { Logger } from '../utils/logger.js';

export class OutboxPollerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static pollIntervalMs = 1000;
  private static batchSize = 10;

  static setIntervalMs(ms: number): void {
    this.pollIntervalMs = ms;
  }

  static isPollerActive(): boolean {
    return this.isRunning;
  }

  /**
   * Starts the outbox poller loop.
   */
  static start(intervalMs = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.pollIntervalMs = intervalMs;

    this.timer = setInterval(async () => {
      try {
        await this.pollAndDispatchBatch();
      } catch (err: any) {
        Logger.error({
          message: `Outbox poller cycle encountered error: ${err.message}`,
          context: 'OutboxPollerService',
          error: err,
        });
      }
    }, this.pollIntervalMs);

    // Unref so poller doesn't block node process exit in tests
    if (this.timer.unref) {
      this.timer.unref();
    }

    Logger.info({
      message: `Transactional Outbox Poller started with interval ${this.pollIntervalMs}ms`,
      context: 'OutboxPollerService',
    });
  }

  /**
   * Stops the outbox poller loop.
   */
  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    Logger.info({
      message: 'Transactional Outbox Poller stopped',
      context: 'OutboxPollerService',
    });
  }

  /**
   * Polls and dispatches a batch of pending outbox events.
   * Concurrency-safe: claims rows with FOR UPDATE SKIP LOCKED.
   */
  static async pollAndDispatchBatch(limit = this.batchSize): Promise<number> {
    let dispatchedCount = 0;

    for (let i = 0; i < limit; i++) {
      const event = await OutboxService.claimNextEvent(undefined, 60000);
      if (!event) {
        break; // No more claimable events in this cycle
      }

      const success = await this.dispatchEvent(event);
      if (success) {
        dispatchedCount++;
      }
    }

    return dispatchedCount;
  }

  /**
   * Dispatches a single claimed event to the appropriate durable queue or service.
   */
  static async dispatchEvent(event: OutboxEventRecord): Promise<boolean> {
    try {
      switch (event.eventType) {
        case 'DOCUMENT_UPLOADED':
        case 'DOCUMENT_RETRY_REQUESTED':
        case 'DOCUMENT_REPLACED': {
          await QueueService.enqueueOcr(
            {
              eventId: event.eventId,
              documentId: event.documentId,
              tenantId: event.tenantId,
              storagePath: event.payload?.storagePath || '',
              mimeType: event.payload?.mimeType || 'application/pdf',
              fileName: event.payload?.fileName || 'document.pdf',
              documentType: event.payload?.documentType || 'purchase-invoice',
              isRetry: event.eventType === 'DOCUMENT_RETRY_REQUESTED',
            },
            event.eventId
          );
          break;
        }

        case 'OCR_COMPLETED':
        case 'EXTRACTION_REQUESTED': {
          await QueueService.enqueueExtraction(
            {
              eventId: event.eventId,
              documentId: event.documentId,
              tenantId: event.tenantId,
              documentType: event.payload?.documentType || 'purchase-invoice',
            },
            event.eventId
          );
          break;
        }

        case 'WEBHOOK_REQUESTED': {
          await QueueService.enqueueWebhook(
            {
              eventId: event.eventId,
              subscriptionId: event.payload?.subscriptionId || '',
              tenantId: event.tenantId,
              eventType: event.payload?.webhookEventType || 'document.processed',
              payload: event.payload || {},
            },
            event.eventId
          );
          break;
        }

        case 'DOCUMENT_PUBLISHED':
        case 'INDEX_DOCUMENT_REQUESTED': {
          // Process legacy event types via OutboxService
          return await OutboxService.processEvent(event);
        }

        default: {
          Logger.warn({
            message: `Unrecognized outbox event type: ${event.eventType}`,
            context: 'OutboxPollerService',
            data: { eventId: event.eventId },
          });
        }
      }

      // Mark event as COMPLETED in database/memory only after publication succeeds
      await this.markEventCompleted(event);
      return true;
    } catch (err: any) {
      await this.markEventFailed(event, err.message);
      return false;
    }
  }

  private static async markEventCompleted(event: OutboxEventRecord): Promise<void> {
    event.status = 'COMPLETED';
    event.processedAt = new Date();
    event.errorMessage = null;

    if (OutboxService.getStoreMode() === 'database') {
      try {
        await dbPool.query(
          `UPDATE outbox_events
           SET status = 'COMPLETED', processed_at = NOW(), error_message = NULL
           WHERE event_id = $1`,
          [event.eventId]
        );
      } catch (err: any) {
        Logger.error({
          message: `Failed to mark outbox event ${event.eventId} as COMPLETED: ${err.message}`,
          context: 'OutboxPollerService',
        });
      }
    }
  }

  private static async markEventFailed(event: OutboxEventRecord, errorMsg: string): Promise<void> {
    event.retryCount += 1;
    event.errorMessage = errorMsg;
    event.status = event.retryCount >= event.maxRetries ? 'FAILED' : 'PENDING';

    Logger.warn({
      message: `Outbox dispatch failed for event ${event.eventId} (attempt ${event.retryCount}/${event.maxRetries}): ${errorMsg}`,
      context: 'OutboxPollerService',
      data: { eventId: event.eventId, status: event.status },
    });

    if (OutboxService.getStoreMode() === 'database') {
      try {
        await dbPool.query(
          `UPDATE outbox_events
           SET status = $1, retry_count = $2, error_message = $3
           WHERE event_id = $4`,
          [event.status, event.retryCount, errorMsg, event.eventId]
        );
      } catch {}
    }
  }
}
