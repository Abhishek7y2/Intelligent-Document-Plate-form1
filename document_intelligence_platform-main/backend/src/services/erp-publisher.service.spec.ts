import { ErpPublisherService } from './erp-publisher.service.js';
import { IntakeService, OcrNotFoundError } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { DocumentExtractionResult } from '../models/extraction.models.js';

describe('ErpPublisherService (Sprint 8 - FR-013 ERP Publishing)', () => {
  const tenantId = 'TENANT-ERP';

  const setupDoc = (docId: string, sha256Hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') => {
    IntakeService.setInMemoryDocument({
      documentId: docId,
      tenantId,
      fileName: `${docId}.pdf`,
      storagePath: `tenants/${tenantId}/${docId}.pdf`,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      sha256Hash,
      documentType: 'purchase-invoice',
      status: 'APPROVED',
      stage: 'APPROVED_PENDING_PUBLISH',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });
  };

  const setupExtraction = (docId: string) => {
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
          extractedValue: 'INV-SAP-881',
          confidence: 0.99,
          status: 'EXTRACTED',
        },
        {
          fieldId: `F-2-${docId}`,
          fieldName: 'net_amount',
          label: 'Net Amount',
          dataType: 'number',
          extractedValue: 10000,
          confidence: 0.97,
          status: 'EXTRACTED',
        },
        {
          fieldId: `F-3-${docId}`,
          fieldName: 'tax_amount',
          label: 'Tax Amount',
          dataType: 'number',
          extractedValue: 1800,
          confidence: 0.97,
          status: 'EXTRACTED',
        },
        {
          fieldId: `F-4-${docId}`,
          fieldName: 'total_amount',
          label: 'Total Amount',
          dataType: 'number',
          extractedValue: 11800,
          confidence: 0.98,
          status: 'EXTRACTED',
        },
      ],
      validationSummary: {
        isValid: true,
        totalFieldsExpected: 4,
        totalFieldsExtracted: 4,
        missingRequiredFields: [],
        lowConfidenceFields: [],
      },
      routingDecision: 'NEEDS_REVIEW',
      extractedAt: new Date().toISOString(),
    };
    ExtractionService.saveExtractionResult(extraction);
  };

  beforeEach(() => {
    IntakeService.clearInMemory();
    ExtractionService.clearInMemory();
    ErpPublisherService.resetState();
  });

  it('should successfully assemble payload, sign HMAC-SHA256, and publish document', async () => {
    setupDoc('DOC-ERP-1');
    setupExtraction('DOC-ERP-1');

    const res = await ErpPublisherService.publishDocument('DOC-ERP-1', tenantId);

    expect(res.success).toBe(true);
    expect(res.status).toBe('PUBLISHED');
    expect(res.attempts).toBe(1);
    expect(res.publishedAt).toBeDefined();

    const record = ErpPublisherService.getPublicationRecord('DOC-ERP-1', tenantId);
    expect(record).toBeDefined();
    expect(record?.erpTarget).toBe('SAP_S4HANA');
    expect(record?.payload.fields['invoice_number']).toBe('INV-SAP-881');
    expect(record?.payload.header.monetaryAmount).toBe(11800);
  });

  it('should enforce idempotency and prevent duplicate dispatch for already published documents', async () => {
    setupDoc('DOC-ERP-IDEMP', 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');

    // First dispatch
    const res1 = await ErpPublisherService.publishDocument('DOC-ERP-IDEMP', tenantId);
    expect(res1.success).toBe(true);
    expect(res1.attempts).toBe(1);

    // Second dispatch with same documentId (idempotent replay)
    const res2 = await ErpPublisherService.publishDocument('DOC-ERP-IDEMP', tenantId);
    expect(res2.success).toBe(true);
    expect(res2.attempts).toBe(1); // Did not increment attempts or resend
    expect(res2.idempotencyKey).toBe(res1.idempotencyKey);
  });

  it('should perform bounded retries with backoff on retryable server errors (503)', async () => {
    setupDoc('DOC-ERP-RETRY', 'hash-retry-erp');

    const res = await ErpPublisherService.publishDocument('DOC-ERP-RETRY', tenantId, {
      simulatedFailure: 'SERVER_ERROR',
      maxRetries: 3,
      initialBackoffMs: 10,
    });

    // SERVER_ERROR fails on first 2 attempts, then succeeds on 3rd attempt
    expect(res.success).toBe(true);
    expect(res.attempts).toBe(3);
    expect(res.status).toBe('PUBLISHED');
  });

  it('should immediately fail and classify non-retryable client errors (400) without retrying', async () => {
    setupDoc('DOC-ERP-CLIENT-ERR', 'hash-badreq-erp');

    const res = await ErpPublisherService.publishDocument('DOC-ERP-CLIENT-ERR', tenantId, {
      simulatedFailure: 'CLIENT_ERROR',
      maxRetries: 3,
    });

    expect(res.success).toBe(false);
    expect(res.attempts).toBe(1); // Stopped after attempt 1
    expect(res.status).toBe('FAILED');

    const record = ErpPublisherService.getPublicationRecord('DOC-ERP-CLIENT-ERR', tenantId);
    expect(record?.failureCategory).toBe('CLIENT_ERROR');
    expect(record?.httpStatusCode).toBe(400);
  });

  it('should classify timeout failures correctly', async () => {
    setupDoc('DOC-ERP-TIMEOUT', 'hash-timeout-erp');

    const res = await ErpPublisherService.publishDocument('DOC-ERP-TIMEOUT', tenantId, {
      simulatedFailure: 'TIMEOUT',
      maxRetries: 2,
      initialBackoffMs: 10,
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED');

    const record = ErpPublisherService.getPublicationRecord('DOC-ERP-TIMEOUT', tenantId);
    expect(record?.failureCategory).toBe('TIMEOUT');
    expect(record?.httpStatusCode).toBe(504);
  });

  it('should reject documents outside tenant boundary with OcrNotFoundError', async () => {
    await expect(
      ErpPublisherService.publishDocument('NON-EXISTENT-DOC', tenantId)
    ).rejects.toThrow(OcrNotFoundError);
  });
});
