import crypto from 'crypto';
import { Job } from 'bullmq';
import { OcrJobData, ExtractionJobData, WebhookJobData } from '../services/queue.service.js';
import { OcrService } from '../services/ocr.service.js';
import { ExtractionService } from '../services/extraction.service.js';
import { IntakeService } from '../services/intake.service.js';
import { OutboxService } from '../services/outbox.service.js';
import { WebhookService } from '../services/webhook.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';
import { runWithCorrelationId } from '../middleware/correlation.middleware.js';

export async function processOcrJob(job: Job<OcrJobData>): Promise<void> {
  const correlationId = job.data.correlationId || crypto.randomUUID();
  return runWithCorrelationId(correlationId, async () => {
    const { documentId, tenantId, fileName, mimeType, documentType, isRetry } = job.data;
    const attemptNumber = (job.attemptsMade || 0) + 1;
    const attemptId = `ATT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    Logger.info({
      message: `Starting OCR processing for document ${documentId} (Attempt ${attemptNumber})`,
      context: 'JobProcessor:OCR',
      data: { documentId, tenantId, attemptNumber, isRetry, correlationId },
    });

    try {
      // 1. Process document through OCR service
      const ocrResult = await OcrService.processDocument(documentId, tenantId);

      // 2. Record successful attempt with correlation ID
      await IntakeService.recordProcessingAttempt({
        id: attemptId,
        documentId,
        tenantId,
        stage: 'OCR',
        attemptNumber,
        succeeded: true,
        error: null,
        correlationId,
        createdAt: new Date(),
      });

      // 3. Trigger extraction by emitting an outbox event
      await OutboxService.recordEvent(tenantId, documentId, 'OCR_COMPLETED', {
        documentType,
        fileName,
        mimeType,
        pageCount: ocrResult.pageCount,
        confidence: ocrResult.overallConfidence,
        correlationId,
      });

      Logger.info({
        message: `OCR processing succeeded for document ${documentId}`,
        context: 'JobProcessor:OCR',
        data: { documentId, tenantId, confidence: ocrResult.overallConfidence },
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown OCR pipeline error';

      // Record failed attempt
      await IntakeService.recordProcessingAttempt({
        id: attemptId,
        documentId,
        tenantId,
        stage: 'OCR',
        attemptNumber,
        succeeded: false,
        error: errorMsg,
        correlationId,
        createdAt: new Date(),
      });

      // Check if max attempts reached (default 5)
      const maxAttempts = job.opts.attempts || 5;
      if (attemptNumber >= maxAttempts) {
        Logger.error({
          message: `OCR processing permanently failed for document ${documentId} after ${attemptNumber} attempts: ${errorMsg}`,
          context: 'JobProcessor:OCR',
          data: { documentId, tenantId, attemptNumber },
        });

        // Mark document as FAILED and record last_error
        if (IntakeService['storeMode'] === 'database') {
          try {
            await dbPool.query(
              `UPDATE documents
               SET status = 'FAILED', stage = 'OCR_PIPELINE_FAILED', last_error = $1
               WHERE document_id = $2 AND tenant_id = $3`,
              [errorMsg, documentId, tenantId]
            );
          } catch {}
        }

        const doc = await IntakeService.getDocument(documentId, tenantId);
        if (doc) {
          doc.status = 'FAILED';
          doc.stage = 'OCR_PIPELINE_FAILED';
          doc.lastError = errorMsg;
          IntakeService.setInMemoryDocument(doc);
        }
      }

      // Rethrow to let BullMQ manage exponential backoff retry
      throw err;
    }
  });
}

export async function processExtractionJob(job: Job<ExtractionJobData>): Promise<void> {
  const correlationId = job.data.correlationId || crypto.randomUUID();
  return runWithCorrelationId(correlationId, async () => {
    const { documentId, tenantId } = job.data;
    const attemptNumber = (job.attemptsMade || 0) + 1;
    const attemptId = `ATT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    Logger.info({
      message: `Starting Field Extraction for document ${documentId} (Attempt ${attemptNumber})`,
      context: 'JobProcessor:Extraction',
      data: { documentId, tenantId, attemptNumber, correlationId },
    });

    try {
      await ExtractionService.extractDocument(documentId, tenantId);

      await IntakeService.recordProcessingAttempt({
        id: attemptId,
        documentId,
        tenantId,
        stage: 'EXTRACTION',
        attemptNumber,
        succeeded: true,
        error: null,
        correlationId,
        createdAt: new Date(),
      });

      Logger.info({
        message: `Extraction completed successfully for document ${documentId}`,
        context: 'JobProcessor:Extraction',
        data: { documentId, tenantId },
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown Extraction error';

      await IntakeService.recordProcessingAttempt({
        id: attemptId,
        documentId,
        tenantId,
        stage: 'EXTRACTION',
        attemptNumber,
        succeeded: false,
        error: errorMsg,
        correlationId,
        createdAt: new Date(),
      });

      const maxAttempts = job.opts.attempts || 5;
      if (attemptNumber >= maxAttempts) {
        Logger.error({
          message: `Extraction permanently failed for document ${documentId} after ${attemptNumber} attempts: ${errorMsg}`,
          context: 'JobProcessor:Extraction',
        });

        if (IntakeService['storeMode'] === 'database') {
          try {
            await dbPool.query(
              `UPDATE documents
               SET status = 'FAILED', stage = 'EXTRACTION_FAILED', last_error = $1
               WHERE document_id = $2 AND tenant_id = $3`,
              [errorMsg, documentId, tenantId]
            );
          } catch {}
        }

        const doc = await IntakeService.getDocument(documentId, tenantId);
        if (doc) {
          doc.status = 'FAILED';
          doc.stage = 'EXTRACTION_FAILED';
          doc.lastError = errorMsg;
          IntakeService.setInMemoryDocument(doc);
        }
      }

      throw err;
    }
  });
}

export async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const correlationId = job.data.correlationId || crypto.randomUUID();
  return runWithCorrelationId(correlationId, async () => {
    const { eventId, subscriptionId, tenantId, eventType, payload } = job.data;
    Logger.info({
      message: `Processing outbound webhook for subscription ${subscriptionId} (Event: ${eventType})`,
      context: 'JobProcessor:Webhook',
      data: { eventId, subscriptionId, tenantId, correlationId },
    });

    await WebhookService.dispatchEvent(tenantId, eventType, payload, {
      eventId,
      correlationId,
    });
  });
}
