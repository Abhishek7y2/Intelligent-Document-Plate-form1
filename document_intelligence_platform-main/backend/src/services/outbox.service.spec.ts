import { OutboxService } from './outbox.service.js';
import { ErpPublisherService } from './erp-publisher.service.js';
import { SearchService } from './search.service.js';
import { IntakeService } from './intake.service.js';
import { ApprovalService } from './approval.service.js';
import { ExtractionService } from './extraction.service.js';
import { DocumentExtractionResult } from '../models/extraction.models.js';
import { AuthenticatedUser } from '../middleware/auth.middleware.js';

describe('OutboxService — Transactional Outbox, Atomicity & Concurrency Verification', () => {
  const tenantId = 'TENANT-OUTBOX-01';
  const documentId = 'DOC-OUTBOX-999';

  const mockApprover: AuthenticatedUser = {
    userId: 'USER-APPROVER-1',
    email: 'approver1@alpha.com',
    role: 'Approver',
    tenantId,
    permissions: ['DOC_VIEW', 'DOC_APPROVE'],
  };

  const setupExtraction = (docId: string, total = 4500) => {
    const extraction: DocumentExtractionResult = {
      extractionId: `EXT-${docId}`,
      documentId: docId,
      tenantId,
      documentType: 'purchase-invoice',
      templateVersion: 'v2.1',
      fields: [
        {
          fieldId: `F-1-${docId}`,
          fieldName: 'invoice_number',
          label: 'Invoice Number',
          dataType: 'string',
          extractedValue: 'INV-100',
          confidence: 0.95,
          status: 'EXTRACTED',
        },
        {
          fieldId: `F-2-${docId}`,
          fieldName: 'total_amount',
          label: 'Total Amount',
          dataType: 'number',
          extractedValue: total,
          confidence: 0.95,
          status: 'EXTRACTED',
        },
      ],
      validationSummary: {
        isValid: true,
        totalFieldsExpected: 2,
        totalFieldsExtracted: 2,
        missingRequiredFields: [],
        lowConfidenceFields: [],
      },
      routingDecision: 'NEEDS_REVIEW',
      extractedAt: new Date().toISOString(),
    };
    ExtractionService.saveExtractionResult(extraction);
  };

  beforeEach(() => {
    OutboxService.setStoreMode('memory');
    OutboxService.clearInMemory();
    ApprovalService.setStoreMode('memory');
    ApprovalService.resetState();
    SearchService.setStoreMode('memory');
    SearchService.clearInMemory();
    ErpPublisherService.resetState();
    IntakeService.clearInMemory();
    ExtractionService.clearInMemory();
    jest.restoreAllMocks();
  });

  describe('Part A — Transaction Atomicity in Final Approval', () => {
    beforeEach(() => {
      // Seed a document ready for final approval with Tier 1 amount ($4500 -> 1 approval required)
      IntakeService.setInMemoryDocument({
        documentId,
        tenantId,
        fileName: 'invoice-999.pdf',
        storagePath: '/uploads/invoice-999.pdf',
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-abc-999',
        documentType: 'purchase-invoice',
        status: 'PENDING_APPROVAL',
        stage: 'AWAITING_TIER_APPROVAL',
        confidenceScore: 0.95,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });
      setupExtraction(documentId, 4500);
    });

    it('rolls back approval decision and document status if outbox event insertion fails (no orphaned events)', async () => {
      await ApprovalService.getOrCreateApprovalRequest(documentId, tenantId);

      // Force outbox recording to fail
      jest.spyOn(OutboxService, 'recordEvent').mockImplementationOnce(async () => {
        throw new Error('Database disk full / transaction failure');
      });

      await expect(
        ApprovalService.submitApprovalDecision(
          documentId,
          tenantId,
          {
            action: 'APPROVE',
            reasonCode: 'Verified',
            comments: 'Approved for ERP release',
          },
          mockApprover
        )
      ).rejects.toThrow('Database disk full / transaction failure');

      // Verify atomic rollback of approval state
      const req = await ApprovalService.getOrCreateApprovalRequest(documentId, tenantId);
      expect(req.status).toBe('PENDING');
      expect(req.approvedCount).toBe(0);
      expect(req.decisions.length).toBe(0);

      // Verify document status was rolled back
      const doc = await IntakeService.getDocument(documentId, tenantId);
      expect(doc?.status).toBe('PENDING_APPROVAL');
      expect(doc?.stage).toBe('AWAITING_TIER_APPROVAL');

      // Verify no orphaned outbox events remain
      const pendingEvents = await OutboxService.getPendingEvents(tenantId);
      expect(pendingEvents.length).toBe(0);
    });

    it('persists durable outbox events and keeps approval committed if subsequent network dispatch fails', async () => {
      await ApprovalService.getOrCreateApprovalRequest(documentId, tenantId);

      // Simulate network dispatch failure during immediate dispatch
      jest.spyOn(OutboxService, 'processPendingEvents').mockRejectedValueOnce(new Error('Network gateway unreachable'));

      const result = await ApprovalService.submitApprovalDecision(
        documentId,
        tenantId,
        {
          action: 'APPROVE',
          reasonCode: 'Verified',
          comments: 'Approved for ERP release',
        },
        mockApprover
      );

      // Approval transaction itself is committed
      expect(result.isFullyApproved).toBe(true);
      expect(result.request.status).toBe('APPROVED');
      expect(result.published).toBe(false); // Immediate dispatch did not complete

      // Document status remains APPROVED_PENDING_PUBLISH
      const doc = await IntakeService.getDocument(documentId, tenantId);
      expect(doc?.status).toBe('APPROVED');
      expect(doc?.stage).toBe('APPROVED_PENDING_PUBLISH');

      // Outbox events are durably stored in PENDING status for background worker recovery
      const pendingEvents = await OutboxService.getPendingEvents(tenantId);
      expect(pendingEvents.length).toBe(2);
      expect(pendingEvents.map((e) => e.eventType)).toEqual(
        expect.arrayContaining(['DOCUMENT_PUBLISHED', 'INDEX_DOCUMENT_REQUESTED'])
      );
    });

    it('recovers and processes durable events to completion on subsequent worker execution', async () => {
      await ApprovalService.getOrCreateApprovalRequest(documentId, tenantId);

      // Fail immediate dispatch attempt
      jest.spyOn(ErpPublisherService, 'publishDocument').mockRejectedValueOnce(new Error('Transient 503 error'));

      const initialResult = await ApprovalService.submitApprovalDecision(
        documentId,
        tenantId,
        {
          action: 'APPROVE',
          reasonCode: 'Verified',
          comments: 'Approved for ERP release',
        },
        mockApprover
      );
      expect(initialResult.isFullyApproved).toBe(true);

      // Mock successful ERP and Search on background worker retry
      jest.spyOn(ErpPublisherService, 'publishDocument').mockResolvedValue({
        success: true,
        documentId,
        destination: 'SAP',
        erpReference: 'SAP-101',
        timestamp: new Date().toISOString(),
      } as any);

      jest.spyOn(SearchService, 'indexDocument').mockResolvedValue({
        status: 'INDEXED',
        chunkCount: 3,
        vectorDimensions: 1536,
      } as any);

      // Background worker run (simulating process restart or scheduled tick)
      const workerRes = await OutboxService.processPendingEvents(tenantId);
      expect(workerRes.processed).toBeGreaterThanOrEqual(1);
      expect(workerRes.succeeded).toBeGreaterThanOrEqual(1);

      // Document is now published
      const doc = await IntakeService.getDocument(documentId, tenantId);
      expect(doc?.status).toBe('PUBLISHED');
      expect(doc?.stage).toBe('ERP_PUBLISHED');
    });
  });

  describe('Part B — Concurrency, Claiming & Crash Recovery', () => {
    it('prevents two workers from claiming or processing the same event concurrently', async () => {
      const evt = await OutboxService.recordEvent(tenantId, documentId, 'DOCUMENT_PUBLISHED');

      // Worker 1 claims the event
      const claim1 = await OutboxService.claimNextEvent(tenantId);
      expect(claim1).toBeDefined();
      expect(claim1?.eventId).toBe(evt.eventId);
      expect(claim1?.status).toBe('PROCESSING');

      // Worker 2 attempts to claim at the same time
      const claim2 = await OutboxService.claimNextEvent(tenantId);
      expect(claim2).toBeNull(); // Safely locked/skipped; cannot claim concurrently
    });

    it('recovers abandoned PROCESSING events after worker crash once lease expires', async () => {
      const evt = await OutboxService.recordEvent(tenantId, documentId, 'INDEX_DOCUMENT_REQUESTED');

      // Worker 1 claims event and then simulates a crash (no completion)
      const claimed = await OutboxService.claimNextEvent(tenantId);
      expect(claimed?.status).toBe('PROCESSING');

      // Simulate lease expiration by setting processingStartedAt to 2 minutes ago
      const stored = OutboxService.getEvent(evt.eventId);
      if (stored) {
        stored.processingStartedAt = new Date(Date.now() - 120000);
      }

      // Worker 2 runs with 60s lease timeout and recovers the abandoned event
      const recoveredClaim = await OutboxService.claimNextEvent(tenantId, 60000);
      expect(recoveredClaim).toBeDefined();
      expect(recoveredClaim?.eventId).toBe(evt.eventId);
      expect(recoveredClaim?.retryCount).toBe(1); // Increment retry count on abandoned recovery
      expect(recoveredClaim?.status).toBe('PROCESSING');

      // Worker 2 processes recovered event to completion
      jest.spyOn(SearchService, 'indexDocument').mockResolvedValue({ status: 'INDEXED' } as any);
      const success = await OutboxService.processEvent(recoveredClaim!);
      expect(success).toBe(true);

      const finalEvt = OutboxService.getEvent(evt.eventId);
      expect(finalEvt?.status).toBe('COMPLETED');
    });

    it('stops retrying and transitions to FAILED when maximum retries is reached', async () => {
      const evt = await OutboxService.recordEvent(tenantId, documentId, 'DOCUMENT_PUBLISHED');
      jest.spyOn(ErpPublisherService, 'publishDocument').mockRejectedValue(new Error('Fatal 500 downstream'));

      // 3 attempts across 3 distinct worker ticks
      await OutboxService.processPendingEvents(tenantId);
      expect(OutboxService.getEvent(evt.eventId)?.retryCount).toBe(1);
      expect(OutboxService.getEvent(evt.eventId)?.status).toBe('PENDING');

      await OutboxService.processPendingEvents(tenantId);
      expect(OutboxService.getEvent(evt.eventId)?.retryCount).toBe(2);
      expect(OutboxService.getEvent(evt.eventId)?.status).toBe('PENDING');

      await OutboxService.processPendingEvents(tenantId);
      const exhausted = OutboxService.getEvent(evt.eventId);
      expect(exhausted?.retryCount).toBe(3);
      expect(exhausted?.status).toBe('FAILED');

      // Subsequent claim returns null; event is dead-lettered
      const noClaim = await OutboxService.claimNextEvent(tenantId);
      expect(noClaim).toBeNull();
    });
  });

  describe('Part C — ERP Idempotency & Lost Response Resilience', () => {
    it('uses identical idempotency identity on retry when ERP accepted but client lost response', async () => {
      IntakeService.setInMemoryDocument({
        documentId,
        tenantId,
        fileName: 'invoice-idemp.pdf',
        storagePath: '/uploads/invoice-idemp.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-fixed-1234567890123456',
        documentType: 'purchase-invoice',
        status: 'APPROVED',
        stage: 'APPROVED_PENDING_PUBLISH',
        confidenceScore: 0.99,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      // First publication dispatch succeeds
      const res1 = await ErpPublisherService.publishDocument(documentId, tenantId);
      expect(res1.success).toBe(true);
      expect(res1.status).toBe('PUBLISHED');
      const originalKey = res1.idempotencyKey;
      const originalPubId = res1.publicationId;

      // Simulate client/worker lost the response and retries the dispatch
      const res2 = await ErpPublisherService.publishDocument(documentId, tenantId);
      expect(res2.success).toBe(true);
      expect(res2.status).toBe('PUBLISHED');
      expect(res2.idempotencyKey).toBe(originalKey);
      expect(res2.publicationId).toBe(originalPubId);
      expect(res2.attempts).toBe(1); // Idempotent check bypassed duplicate webhook dispatch
    });
  });

  describe('Part D — Indexing Retries & Stale Version Protection', () => {
    beforeEach(() => {
      IntakeService.setInMemoryDocument({
        documentId,
        tenantId,
        fileName: 'contract-v1.pdf',
        storagePath: '/uploads/contract-v1.pdf',
        fileSizeBytes: 4096,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-contract-1',
        documentType: 'supplier_contract',
        status: 'APPROVED',
        stage: 'APPROVED_PENDING_PUBLISH',
        confidenceScore: 0.98,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });
    });

    it('re-indexing document replaces existing chunks without creating duplicates', async () => {
      // First indexing pass
      const res1 = await SearchService.indexDocument(documentId, tenantId, { force: true });
      expect(res1.status).toBe('INDEXED');
      const chunksCount1 = res1.chunksIndexed;

      // Second indexing pass (retry or update)
      const res2 = await SearchService.indexDocument(documentId, tenantId, { force: true });
      expect(res2.status).toBe('INDEXED');
      expect(res2.chunksIndexed).toBe(chunksCount1);

      // Verify search results return exactly chunksCount1, not duplicated
      const searchRes = await SearchService.search(tenantId, { query: 'Contract', limit: 20 });
      const matchingChunks = searchRes.results.filter((r) => r.docId === documentId);
      expect(matchingChunks.length).toBe(chunksCount1);
    });

    it('rejects stale version indexing retries from overwriting newer active chunks', async () => {
      // Index version 2.0
      await SearchService.indexDocument(documentId, tenantId, { expectedVersion: 'v2.0' });

      // Simulate late retry of version 1.0 outbox event
      const staleRes = await SearchService.indexDocument(documentId, tenantId, { expectedVersion: 'v1.0' });
      expect(staleRes.status).toBe('SKIPPED');
      expect(staleRes.reason).toContain('Stale version indexing rejected');

      // Verify active chunks remain on v2.0
      const searchRes = await SearchService.search(tenantId, { query: 'Contract', limit: 10 });
      const docChunks = searchRes.results.filter((r) => r.docId === documentId);
      expect(docChunks.length).toBeGreaterThan(0);
      expect(docChunks[0]?.sourceVersion).toBe('v2.0');
    });
  });
});
