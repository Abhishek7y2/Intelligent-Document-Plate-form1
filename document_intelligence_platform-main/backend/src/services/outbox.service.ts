import crypto from 'crypto';
import type pg from 'pg';
import {
  OutboxEventRecord,
  OutboxEventType,
} from '../models/outbox.models.js';
import { ErpPublisherService } from './erp-publisher.service.js';
import { SearchService } from './search.service.js';
import { IntakeService } from './intake.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

import { getCorrelationId } from '../middleware/correlation.middleware.js';

export class OutboxService {
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryEvents = new Map<string, OutboxEventRecord>();

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStoreMode(): 'memory' | 'database' {
    return this.storeMode;
  }

  static clearInMemory(): void {
    this.inMemoryEvents.clear();
  }

  static removeEvent(eventId: string): void {
    this.inMemoryEvents.delete(eventId);
  }

  /**
   * Durably records an outbox event.
   * Supports an optional pg.PoolClient to bind the insert to an active atomic transaction.
   */
  static async recordEvent(
    tenantId: string,
    documentId: string,
    eventType: OutboxEventType,
    payload: Record<string, any> = {},
    client?: pg.PoolClient
  ): Promise<OutboxEventRecord> {
    const eventId = `EVT-${crypto.randomBytes(8).toString('hex')}`;
    const activeCorrelationId = payload['correlationId'] || (getCorrelationId() !== 'N/A' ? getCorrelationId() : null);
    const record: OutboxEventRecord = {
      eventId,
      tenantId,
      documentId,
      eventType,
      payload,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      correlationId: activeCorrelationId,
      createdAt: new Date(),
      processingStartedAt: null,
      processedAt: null,
    };

    if (this.storeMode === 'database') {
      try {
        const executor = client || dbPool;
        await executor.query(
          `INSERT INTO outbox_events (
            event_id, tenant_id, document_id, event_type, payload, status, retry_count, max_retries, created_at, correlation_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            record.eventId,
            record.tenantId,
            record.documentId,
            record.eventType,
            JSON.stringify(record.payload),
            record.status,
            record.retryCount,
            record.maxRetries,
            record.createdAt,
            record.correlationId,
          ]
        );
      } catch (err: any) {
        Logger.error({
          message: `Database outbox insert failed for event ${eventId}: ${err.message}`,
          context: 'OutboxService',
          error: err,
        });
        throw err;
      }
    } else {
      this.inMemoryEvents.set(eventId, record);
    }

    Logger.info({
      message: `Outbox event enqueued: ${eventType} for document ${documentId}`,
      context: 'OutboxService',
      data: { eventId, tenantId, documentId, eventType },
    });

    return record;
  }

  /**
   * Atomically claims the next claimable event for worker processing.
   * Prevents concurrent workers from processing the same event.
   * Recovers abandoned PROCESSING events whose lease has expired.
   */
  static async claimNextEvent(
    tenantId?: string,
    leaseTimeoutMs: number = 60000,
    excludedEventIds?: Set<string>
  ): Promise<OutboxEventRecord | null> {
    if (this.storeMode === 'database') {
      try {
        const sql = `
          WITH claimable AS (
            SELECT event_id
            FROM outbox_events
            WHERE ($1::text IS NULL OR tenant_id = $1)
              AND (
                (status IN ('PENDING', 'FAILED') AND retry_count < max_retries)
                OR (status = 'PROCESSING' AND processing_started_at < NOW() - ($2 || ' milliseconds')::INTERVAL AND retry_count < max_retries)
              )
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE outbox_events
          SET status = 'PROCESSING',
              processing_started_at = NOW(),
              retry_count = CASE 
                WHEN outbox_events.status = 'PROCESSING' THEN outbox_events.retry_count + 1 
                ELSE outbox_events.retry_count 
              END
          FROM claimable
          WHERE outbox_events.event_id = claimable.event_id
          RETURNING outbox_events.event_id as "eventId", outbox_events.tenant_id as "tenantId",
                    outbox_events.document_id as "documentId", outbox_events.event_type as "eventType",
                    outbox_events.payload, outbox_events.status, outbox_events.retry_count as "retryCount",
                    outbox_events.max_retries as "maxRetries", outbox_events.error_message as "errorMessage",
                    outbox_events.created_at as "createdAt", outbox_events.processing_started_at as "processingStartedAt",
                    outbox_events.processed_at as "processedAt";
        `;
        const res = await dbPool.query(sql, [tenantId || null, leaseTimeoutMs]);
        if (res.rows.length === 0) return null;
        return res.rows[0];
      } catch (err: any) {
        Logger.warn({
          message: `Database claimNextEvent failed; falling back to memory: ${err.message}`,
          context: 'OutboxService',
        });
      }
    }

    // In-memory atomic claim logic
    const now = Date.now();
    for (const evt of this.inMemoryEvents.values()) {
      if (tenantId && evt.tenantId !== tenantId) continue;
      if (excludedEventIds && excludedEventIds.has(evt.eventId)) continue;

      const isPendingOrFailed = (evt.status === 'PENDING' || evt.status === 'FAILED') && evt.retryCount < evt.maxRetries;
      const isAbandonedProcessing = evt.status === 'PROCESSING' &&
        evt.processingStartedAt !== null &&
        evt.processingStartedAt !== undefined &&
        (now - evt.processingStartedAt.getTime() >= leaseTimeoutMs) &&
        evt.retryCount < evt.maxRetries;

      if (isPendingOrFailed || isAbandonedProcessing) {
        if (isAbandonedProcessing) {
          evt.retryCount += 1;
        }
        evt.status = 'PROCESSING';
        evt.processingStartedAt = new Date();
        this.inMemoryEvents.set(evt.eventId, { ...evt });
        return { ...evt };
      }
    }

    return null;
  }

  /**
   * Processes a single claimed outbox event.
   */
  static async processEvent(event: OutboxEventRecord): Promise<boolean> {
    try {
      if (event.eventType === 'DOCUMENT_PUBLISHED') {
        const res = await ErpPublisherService.publishDocument(event.documentId, event.tenantId);
        if (!res.success) {
          throw new Error(res.error || 'ERP publication dispatch failed');
        }
        await IntakeService.updateDocument(event.documentId, event.tenantId, {
          status: 'PUBLISHED',
          stage: 'ERP_PUBLISHED',
        });
      } else if (event.eventType === 'INDEX_DOCUMENT_REQUESTED') {
        const res = await SearchService.indexDocument(event.documentId, event.tenantId, {
          force: true,
          expectedVersion: event.payload?.sourceVersion,
        });
        if (res.status === 'FAILED') {
          throw new Error(res.reason || 'Vector indexing failed');
        }
      }

      event.status = 'COMPLETED';
      event.processedAt = new Date();
      event.errorMessage = null;

      if (this.storeMode === 'database') {
        await dbPool.query(
          `UPDATE outbox_events
           SET status = 'COMPLETED', processed_at = $1, error_message = NULL
           WHERE event_id = $2`,
          [event.processedAt, event.eventId]
        );
      } else {
        this.inMemoryEvents.set(event.eventId, { ...event });
      }

      Logger.info({
        message: `Outbox event ${event.eventId} (${event.eventType}) completed successfully`,
        context: 'OutboxService',
        data: { eventId: event.eventId, documentId: event.documentId },
      });

      return true;
    } catch (err: any) {
      event.retryCount += 1;
      event.errorMessage = err.message || 'Unknown processing error';
      event.status = event.retryCount >= event.maxRetries ? 'FAILED' : 'PENDING';

      Logger.warn({
        message: `Outbox event ${event.eventId} (${event.eventType}) failed attempt ${event.retryCount}: ${event.errorMessage}`,
        context: 'OutboxService',
        data: { eventId: event.eventId, retryCount: event.retryCount, status: event.status },
      });

      if (this.storeMode === 'database') {
        try {
          await dbPool.query(
            `UPDATE outbox_events
             SET status = $1, retry_count = $2, error_message = $3
             WHERE event_id = $4`,
            [event.status, event.retryCount, event.errorMessage, event.eventId]
          );
        } catch {
          // ignore database update failure in catch block
        }
      } else {
        this.inMemoryEvents.set(event.eventId, { ...event });
      }

      return false;
    }
  }

  /**
   * Outbox worker: loops through claimable events and processes them.
   */
  static async processPendingEvents(
    tenantId?: string,
    options?: { maxEvents?: number; leaseTimeoutMs?: number }
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const maxEvents = options?.maxEvents ?? 50;
    const leaseTimeoutMs = options?.leaseTimeoutMs ?? 60000;
    let count = 0;
    let succeeded = 0;
    let failed = 0;

    const attemptedEventIds = new Set<string>();

    while (count < maxEvents) {
      const event = await this.claimNextEvent(tenantId, leaseTimeoutMs, attemptedEventIds);
      if (!event) break;

      attemptedEventIds.add(event.eventId);
      count++;
      const success = await this.processEvent(event);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { processed: count, succeeded, failed };
  }

  /**
   * Retrieves pending or retry-eligible outbox events (read-only inspection).
   */
  static async getPendingEvents(tenantId?: string): Promise<OutboxEventRecord[]> {
    if (this.storeMode === 'database') {
      try {
        const sql = tenantId
          ? `SELECT event_id as "eventId", tenant_id as "tenantId", document_id as "documentId",
                    event_type as "eventType", payload, status, retry_count as "retryCount",
                    max_retries as "maxRetries", error_message as "errorMessage",
                    created_at as "createdAt", processing_started_at as "processingStartedAt",
                    processed_at as "processedAt"
             FROM outbox_events
             WHERE tenant_id = $1 AND status IN ('PENDING', 'FAILED') AND retry_count < max_retries
             ORDER BY created_at ASC`
          : `SELECT event_id as "eventId", tenant_id as "tenantId", document_id as "documentId",
                    event_type as "eventType", payload, status, retry_count as "retryCount",
                    max_retries as "maxRetries", error_message as "errorMessage",
                    created_at as "createdAt", processing_started_at as "processingStartedAt",
                    processed_at as "processedAt"
             FROM outbox_events
             WHERE status IN ('PENDING', 'FAILED') AND retry_count < max_retries
             ORDER BY created_at ASC`;
        const params = tenantId ? [tenantId] : [];
        const res = await dbPool.query(sql, params);
        return res.rows;
      } catch (err: any) {
        Logger.warn({
          message: `Database outbox fetch failed; falling back to memory: ${err.message}`,
          context: 'OutboxService',
        });
      }
    }

    const events: OutboxEventRecord[] = [];
    for (const evt of this.inMemoryEvents.values()) {
      if (tenantId && evt.tenantId !== tenantId) continue;
      if ((evt.status === 'PENDING' || evt.status === 'FAILED') && evt.retryCount < evt.maxRetries) {
        events.push({ ...evt });
      }
    }
    return events;
  }

  private static workerTimer: NodeJS.Timeout | null = null;

  /**
   * Starts real background scheduled worker to reliably process pending outbox events.
   */
  static startWorker(pollIntervalMs: number = 5000): void {
    if (this.workerTimer) return;

    Logger.info({
      message: `Outbox polling worker started (interval: ${pollIntervalMs}ms)`,
      context: 'OutboxService',
    });

    this.workerTimer = setInterval(async () => {
      try {
        await this.processPendingEvents();
      } catch (err: any) {
        Logger.error({
          message: `Outbox worker cycle error: ${err.message}`,
          context: 'OutboxService',
          error: err,
        });
      }
    }, pollIntervalMs);

    if (this.workerTimer.unref) {
      this.workerTimer.unref();
    }
  }

  /**
   * Stops background scheduled worker.
   */
  static stopWorker(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      Logger.info({
        message: 'Outbox polling worker stopped.',
        context: 'OutboxService',
      });
    }
  }

  static getEvent(eventId: string): OutboxEventRecord | null {
    return this.inMemoryEvents.get(eventId) || null;
  }

  static async findByCorrelationId(tenantId: string, correlationId: string): Promise<OutboxEventRecord[]> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id as "eventId", tenant_id as "tenantId", document_id as "documentId",
                  event_type as "eventType", payload, status, retry_count as "retryCount",
                  correlation_id as "correlationId", created_at as "createdAt"
           FROM outbox_events
           WHERE tenant_id = $1 AND correlation_id = $2
           ORDER BY created_at ASC`,
          [tenantId, correlationId]
        );
        return res.rows;
      } catch {}
    }

    return Array.from(this.inMemoryEvents.values()).filter(
      (e) => e.tenantId === tenantId && e.correlationId === correlationId
    );
  }
}
