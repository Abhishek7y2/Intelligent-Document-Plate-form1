import { IntakeService } from './intake.service.js';
import { OutboxService } from './outbox.service.js';
import { OutboxPollerService } from './outbox-poller.service.js';
import { QueueService } from './queue.service.js';
import { processOcrJob } from '../workers/job-processors.js';
import { MockMalwareScanner, EICAR_TEST_STRING } from './scanner.service.js';
import { MemoryStorageService } from './storage.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { OcrService } from './ocr.service.js';
import { dbPool } from '../database/postgres.client.js';

describe('Sprint 3: Durable Queue, Transactional Outbox and Retry Handling Suite', () => {
  const tenantA = 'TNT-CORP-ALPHA';
  const tenantB = 'TNT-CORP-BETA';
  const dummyBuffer = Buffer.from('%PDF-1.4\nTest Sprint 3 Pipeline Content\n%%EOF');

  beforeEach(() => {
    IntakeService.clearInMemory();
    OutboxService.clearInMemory();
    QueueService.clearInMemory();
    QueueService.setMode('memory');
    IntakeService.setStorage(new MemoryStorageService());
    IntakeService.setScanner(new MockMalwareScanner('heuristic'));
    OcrService.setEngine(new SyntheticMockOcrAdapter('standard'));
  });

  afterAll(async () => {
    OutboxPollerService.stop();
    await QueueService.closeAll();
    try {
      await dbPool.end();
    } catch {}
  });

  // =========================================================================
  // 1. ATOMIC DOCUMENT AND OUTBOX EVENT CREATION
  // =========================================================================
  describe('1. Atomic Document & Outbox Creation', () => {
    it('should write document record and DOCUMENT_UPLOADED outbox event atomically upon ingestion', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'quarterly_report.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      // 1. Verify document is queued
      const doc = await IntakeService.getDocument(upload.documentId, tenantA);
      expect(doc).not.toBeNull();
      expect(doc?.status).toBe('QUEUED');
      expect(doc?.stage).toBe('INGESTION_COMPLETE');

      // 2. Verify outbox event was recorded atomically
      const pendingEvent = await OutboxService.claimNextEvent(tenantA);
      expect(pendingEvent).not.toBeNull();
      expect(pendingEvent?.documentId).toBe(upload.documentId);
      expect(pendingEvent?.eventType).toBe('DOCUMENT_UPLOADED');
      expect(pendingEvent?.status).toBe('PROCESSING');
    });

    it('should never create an outbox event when file is quarantined due to malware', async () => {
      const infectedBuffer = Buffer.from(`%PDF-1.4\n${EICAR_TEST_STRING}\n%%EOF`);

      await expect(
        IntakeService.ingestDocument({
          tenantId: tenantA,
          userId: 'USR-88210',
          buffer: infectedBuffer,
          originalFilename: 'malicious.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(/Malware detected/);

      // Verify no outbox events exist for the quarantined upload
      const event = await OutboxService.claimNextEvent(tenantA);
      expect(event).toBeNull();
    });
  });

  // =========================================================================
  // 2. TRANSACTIONAL OUTBOX POLLER & DISPATCHER
  // =========================================================================
  describe('2. Transactional Outbox Poller & Queue Dispatch', () => {
    it('should poll unprocessed DOCUMENT_UPLOADED events and enqueue to OCR queue', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'test_invoice.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Execute a single poller cycle
      const dispatched = await OutboxPollerService.pollAndDispatchBatch(5);
      expect(dispatched).toBe(1);

      // Verify OCR queue received job with deterministic ID
      const ocrJobs = QueueService.getInMemoryJobs('ocr');
      expect(ocrJobs.length).toBe(1);
      expect(ocrJobs[0].data.documentId).toBe(upload.documentId);
      expect(ocrJobs[0].id).toContain('outbox-EVT-');
    });

    it('should prevent concurrent pollers from double-claiming or double-enqueueing', async () => {
      await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'concurrent_doc.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Run two poller cycles concurrently
      const [dispatched1, dispatched2] = await Promise.all([
        OutboxPollerService.pollAndDispatchBatch(1),
        OutboxPollerService.pollAndDispatchBatch(1),
      ]);

      // Exactly 1 poller claims and dispatches the event; the other gets 0
      expect(dispatched1 + dispatched2).toBe(1);

      const ocrJobs = QueueService.getInMemoryJobs('ocr');
      expect(ocrJobs.length).toBe(1);
    });

    it('should be safe when duplicate event is encountered due to deterministic jobId', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'idempotent.pdf',
        declaredMimeType: 'application/pdf',
      });

      const event = await OutboxService.claimNextEvent(tenantA);
      expect(event).not.toBeNull();

      // Dispatch event twice
      await OutboxPollerService.dispatchEvent(event!);
      await OutboxPollerService.dispatchEvent(event!);

      const ocrJobs = QueueService.getInMemoryJobs('ocr');
      // Only 1 job in queue due to deterministic outbox jobId idempotency
      expect(ocrJobs.length).toBe(1);
      expect(ocrJobs[0].data.documentId).toBe(upload.documentId);
    });
  });

  // =========================================================================
  // 3. DEDICATED WORKERS, ATTEMPTS & RETRY HANDLING
  // =========================================================================
  describe('3. Dedicated Worker Execution, Retries & Dead-Letter Handling', () => {
    it('should process OCR job successfully and record a successful processing attempt', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'worker_success.pdf',
        declaredMimeType: 'application/pdf',
      });

      const mockJob = {
        id: 'job-ocr-001',
        attemptsMade: 0,
        opts: { attempts: 5 },
        data: {
          eventId: 'EVT-TEST-001',
          documentId: upload.documentId,
          tenantId: tenantA,
          storagePath: `memory://tenants/${tenantA}/raw/${upload.documentId}.pdf`,
          mimeType: 'application/pdf',
          fileName: 'worker_success.pdf',
          documentType: 'purchase-invoice',
        },
      } as any;

      await processOcrJob(mockJob);

      // Verify attempt history was recorded
      const attempts = await IntakeService.listProcessingAttempts(upload.documentId, tenantA);
      expect(attempts.length).toBe(1);
      expect(attempts[0].stage).toBe('OCR');
      expect(attempts[0].succeeded).toBe(true);
      expect(attempts[0].attemptNumber).toBe(1);

      // Verify document status updated
      const doc = await IntakeService.getDocument(upload.documentId, tenantA);
      expect(doc?.status).toBe('STP_PROCESSED');
      expect(doc?.stage).toBe('OCR_COMPLETE');
    });

    it('should record failed attempt and mark document FAILED on final exhausted attempt (attempt 5)', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'corrupt_doc.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Configure OCR engine to simulate corrupt failure
      OcrService.setEngine(new SyntheticMockOcrAdapter('corrupt'));

      const mockJobFinalAttempt = {
        id: 'job-ocr-fail-005',
        attemptsMade: 4, // 5th attempt (0-indexed 4 attemptsMade + 1 = 5)
        opts: { attempts: 5 },
        data: {
          eventId: 'EVT-FAIL-005',
          documentId: upload.documentId,
          tenantId: tenantA,
          storagePath: `memory://tenants/${tenantA}/raw/${upload.documentId}.pdf`,
          mimeType: 'application/pdf',
          fileName: 'corrupt_doc.pdf',
          documentType: 'purchase-invoice',
        },
      } as any;

      await expect(processOcrJob(mockJobFinalAttempt)).rejects.toThrow(/Document file is corrupt/);

      // Verify failed attempt record
      const attempts = await IntakeService.listProcessingAttempts(upload.documentId, tenantA);
      expect(attempts.length).toBe(1);
      expect(attempts[0].stage).toBe('OCR');
      expect(attempts[0].succeeded).toBe(false);
      expect(attempts[0].error).toContain('Document file is corrupt');

      // Verify document marked as FAILED with lastError
      const doc = await IntakeService.getDocument(upload.documentId, tenantA);
      expect(doc?.status).toBe('FAILED');
      expect(doc?.stage).toBe('OCR_PIPELINE_FAILED');
      expect(doc?.lastError).toContain('Document file is corrupt');
    });
  });

  // =========================================================================
  // 4. MANUAL RETRY API & TENANT ISOLATION
  // =========================================================================
  describe('4. Manual Retry Workflow & Tenant Isolation', () => {
    it('should reject retry for documents that are not in FAILED status (400)', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'in_progress.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Document is in status QUEUED
      await expect(
        IntakeService.retryDocument(upload.documentId, tenantA, 'USR-ADMIN-01')
      ).rejects.toThrow(/DOCUMENT_NOT_ELIGIBLE_FOR_RETRY/);
    });

    it('should enforce tenant boundary and reject cross-tenant retry requests (404)', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'tenant_a_doc.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Tenant B tries to retry Tenant A's document
      await expect(
        IntakeService.retryDocument(upload.documentId, tenantB, 'USR-TENANT-B')
      ).rejects.toThrow(/not found within tenant boundary/);
    });

    it('should permit retry for eligible FAILED document, increment retryCount and enqueue outbox event', async () => {
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyBuffer,
        originalFilename: 'failed_then_retried.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Drain initial upload outbox event so outbox queue is clear for retry
      const initialUploadEvent = await OutboxService.claimNextEvent(tenantA);
      if (initialUploadEvent) {
        await OutboxPollerService.dispatchEvent(initialUploadEvent);
      }

      // Mark document as FAILED
      await IntakeService.updateDocument(upload.documentId, tenantA, {
        status: 'FAILED',
        stage: 'OCR_PIPELINE_FAILED',
      });

      // Execute manual retry
      const retried = await IntakeService.retryDocument(upload.documentId, tenantA, 'USR-OPERATOR-01');
      expect(retried.status).toBe('QUEUED');
      expect(retried.stage).toBe('INGESTION_COMPLETE');
      expect(retried.retryCount).toBe(1);
      expect(retried.lastError).toBeNull();

      // Verify DOCUMENT_RETRY_REQUESTED outbox event was generated
      const outboxEvent = await OutboxService.claimNextEvent(tenantA);
      expect(outboxEvent).not.toBeNull();
      expect(outboxEvent?.eventType).toBe('DOCUMENT_RETRY_REQUESTED');
      expect(outboxEvent?.documentId).toBe(upload.documentId);
      expect(outboxEvent?.payload.retryCount).toBe(1);

      // Dispatching outbox event enqueues job to OCR queue with isRetry = true
      await OutboxPollerService.dispatchEvent(outboxEvent!);
      const ocrJobs = QueueService.getInMemoryJobs('ocr');
      const retryJob = ocrJobs.find((j) => j.data.isRetry === true);
      expect(retryJob).toBeDefined();
      expect(retryJob.data.documentId).toBe(upload.documentId);
    });
  });
});
