import { ReviewService } from './review.service.js';
import { IntakeService } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { DocumentExtractionResult } from '../models/extraction.models.js';
import { AuthenticatedUser } from '../middleware/auth.middleware.js';

describe('ReviewService (HITL Review Workbench & Audit Pipeline)', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  const mockUser: AuthenticatedUser = {
    userId: 'USR-REVIEWER-01',
    email: 'reviewer@docunexa.com',
    role: 'Reviewer',
    tenantId: tenantA,
    permissions: ['DOC_VIEW', 'DOC_EDIT', 'DOC_VERIFY'],
  };

  beforeEach(() => {
    IntakeService.clearInMemory();
    ExtractionService.clearInMemory();
    ReviewService.clearInMemory();
  });

  const setupDocument = (docId: string, tenantId: string, status: any = 'NEEDS_REVIEW', stage = 'HITL_REVIEW_PENDING') => {
    IntakeService.setInMemoryDocument({
      documentId: docId,
      tenantId,
      fileName: `${docId}.pdf`,
      storagePath: `tenants/${tenantId}/${docId}.pdf`,
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      sha256Hash: `hash-${docId}`,
      documentType: 'purchase-invoice',
      status,
      stage,
      confidenceScore: 0.78,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });
  };

  const setupExtraction = (docId: string, tenantId: string, net = 100, tax = 20, total = 140) => {
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
          extractedValue: 'INV-9042',
          confidence: 0.95,
          status: 'EXTRACTED',
          groundedEvidence: {
            pageNumber: 1,
            textSnippet: 'INV-9042',
            boundingBox: { left: 100, top: 120, width: 80, height: 25 },
            polygon: [100, 120, 180, 120, 180, 145, 100, 145],
            wordTokens: [],
          },
        },
        {
          fieldId: `F-2-${docId}`,
          fieldName: 'net_amount',
          label: 'Net Amount',
          dataType: 'number',
          extractedValue: net,
          confidence: 0.92,
          status: 'EXTRACTED',
          groundedEvidence: {
            pageNumber: 1,
            textSnippet: String(net),
            boundingBox: { left: 400, top: 500, width: 60, height: 25 },
            polygon: [400, 500, 460, 500, 460, 525, 400, 525],
            wordTokens: [],
          },
        },
        {
          fieldId: `F-3-${docId}`,
          fieldName: 'tax_amount',
          label: 'Tax Amount',
          dataType: 'number',
          extractedValue: tax,
          confidence: 0.90,
          status: 'EXTRACTED',
          groundedEvidence: {
            pageNumber: 1,
            textSnippet: String(tax),
            boundingBox: { left: 400, top: 530, width: 50, height: 25 },
            polygon: [400, 530, 450, 530, 450, 555, 400, 555],
            wordTokens: [],
          },
        },
        {
          fieldId: `F-4-${docId}`,
          fieldName: 'total_amount',
          label: 'Total Amount',
          dataType: 'number',
          extractedValue: total,
          confidence: 0.75, // low confidence
          status: 'LOW_CONFIDENCE',
          groundedEvidence: {
            pageNumber: 1,
            textSnippet: String(total),
            boundingBox: { left: 400, top: 560, width: 70, height: 30 },
            polygon: [400, 560, 470, 560, 470, 590, 400, 590],
            wordTokens: [],
          },
        },
      ],
      validationSummary: {
        isValid: false,
        totalFieldsExpected: 4,
        totalFieldsExtracted: 4,
        missingRequiredFields: [],
        lowConfidenceFields: ['total_amount'],
        reconciliationResult: {
          status: 'MISMATCH',
          netAmount: net,
          taxAmount: tax,
          totalAmount: total,
          expectedTotal: net + tax,
          delta: Math.abs(net + tax - total),
          isReconciled: false,
          discrepancyReason: 'Net + Tax != Total',
        },
      },
      routingDecision: 'NEEDS_REVIEW',
      extractedAt: new Date().toISOString(),
    };

    ExtractionService.saveExtractionResult(extraction);
  };

  describe('Review Queue (getReviewQueue)', () => {
    it('should list documents with NEEDS_REVIEW or HITL_REVIEW_PENDING for the tenant', async () => {
      setupDocument('DOC-REV-1', tenantA, 'NEEDS_REVIEW', 'HITL_REVIEW_PENDING');
      setupDocument('DOC-REV-2', tenantA, 'NEEDS_REVIEW', 'CLASSIFICATION_TRIAGE');
      setupDocument('DOC-OTHER-STATUS', tenantA, 'APPROVED', 'COMPLETED');
      setupDocument('DOC-OTHER-TENANT', tenantB, 'NEEDS_REVIEW', 'HITL_REVIEW_PENDING');

      const queue = await ReviewService.getReviewQueue(tenantA);

      expect(queue.length).toBe(2);
      expect(queue.map((t) => t.docId)).toEqual(['DOC-REV-1', 'DOC-REV-2']);
      expect(queue[0].tenantId).toBe(tenantA);
      expect(queue[0].status).toBe('Pending Review');
    });

    it('should assign High priority to low-confidence or discrepant documents', async () => {
      setupDocument('DOC-LOWCONF', tenantA, 'NEEDS_REVIEW', 'HITL_REVIEW_PENDING');
      setupExtraction('DOC-LOWCONF', tenantA, 100, 20, 140);

      const queue = await ReviewService.getReviewQueue(tenantA);
      const item = queue.find((t) => t.docId === 'DOC-LOWCONF');

      expect(item).toBeDefined();
      expect(item?.priority).toBe('High');
    });
  });

  describe('Review Workbench Details (getReviewWorkbenchData)', () => {
    it('should aggregate document metadata, fields, bounding boxes, and reconciliation', async () => {
      setupDocument('DOC-DETAIL-1', tenantA);
      setupExtraction('DOC-DETAIL-1', tenantA, 100, 20, 140);

      const data = await ReviewService.getReviewWorkbenchData('DOC-DETAIL-1', tenantA);

      expect(data.documentId).toBe('DOC-DETAIL-1');
      expect(data.status).toBe('NEEDS_REVIEW');
      expect(data.fields.length).toBe(4);
      expect(data.boundingBoxes.length).toBe(4);
      expect(data.boundingBoxes[0]).toHaveProperty('fieldKey', 'invoice_number');
      expect(data.boundingBoxes[0]).toHaveProperty('top', 3.64);
      expect(data.boundingBoxes[0]).toHaveProperty('left', 3.92);
      expect(data.reconciliationResult?.status).toBe('MISMATCH');
    });

    it('should reject non-existent document with 404 OcrNotFoundError', async () => {
      await expect(ReviewService.getReviewWorkbenchData('DOC-NONEXISTENT', tenantA)).rejects.toThrow(
        /not found within tenant boundary/
      );
    });

    it('should reject cross-tenant access with 404', async () => {
      setupDocument('DOC-TENANT-FENCE', tenantB);
      await expect(ReviewService.getReviewWorkbenchData('DOC-TENANT-FENCE', tenantA)).rejects.toThrow(
        /not found within tenant boundary/
      );
    });

    it('should reject quarantined document with 403 DOCUMENT_QUARANTINED', async () => {
      setupDocument('DOC-QUARANTINED', tenantA, 'QUARANTINED');
      await expect(ReviewService.getReviewWorkbenchData('DOC-QUARANTINED', tenantA)).rejects.toMatchObject({
        statusCode: 403,
        code: 'DOCUMENT_QUARANTINED',
      });
    });

    it('should reject unscanned document with 400 DOCUMENT_NOT_SCANNED', async () => {
      setupDocument('DOC-UNSCANNED', tenantA, 'PENDING_SCAN');
      await expect(ReviewService.getReviewWorkbenchData('DOC-UNSCANNED', tenantA)).rejects.toMatchObject({
        statusCode: 400,
        code: 'DOCUMENT_NOT_SCANNED',
      });
    });
  });

  describe('Field Correction (correctField)', () => {
    it('should update field value, mark status EXTRACTED with confidence 1.0, and record correction history', async () => {
      setupDocument('DOC-CORR-1', tenantA);
      setupExtraction('DOC-CORR-1', tenantA, 100, 20, 140);

      const result = await ReviewService.correctField(
        'DOC-CORR-1',
        tenantA,
        'invoice_number',
        { correctedValue: 'INV-9042-CORRECTED', reason: 'OCR misread character' },
        mockUser
      );

      expect(result.field.extractedValue).toBe('INV-9042-CORRECTED');
      expect(result.field.confidence).toBe(1.0);

      // Verify audit history
      const workbench = await ReviewService.getReviewWorkbenchData('DOC-CORR-1', tenantA);
      expect(workbench.corrections.length).toBe(1);
      expect(workbench.corrections[0].originalValue).toBe('INV-9042');
      expect(workbench.corrections[0].correctedValue).toBe('INV-9042-CORRECTED');
      expect(workbench.corrections[0].reviewerName).toBe(mockUser.email);
    });

    it('should re-evaluate invoice math when financial amount is corrected to fix mismatch', async () => {
      setupDocument('DOC-MATH-FIX', tenantA);
      setupExtraction('DOC-MATH-FIX', tenantA, 100, 20, 140); // 100 + 20 != 140 (MISMATCH)

      // Correct total_amount to 120.00
      const result = await ReviewService.correctField(
        'DOC-MATH-FIX',
        tenantA,
        'total_amount',
        { correctedValue: 120, reason: 'Manual total fix' },
        mockUser
      );

      expect(result.reconciliationResult).toBeDefined();
      expect(result.reconciliationResult.status).toBe('MATCHED');
      expect(result.reconciliationResult.isReconciled).toBe(true);
      expect(result.reconciliationResult.delta).toBe(0);
    });

    it('should reject correction for field not present in extraction with 400 FIELD_NOT_FOUND', async () => {
      setupDocument('DOC-INVALID-FIELD', tenantA);
      setupExtraction('DOC-INVALID-FIELD', tenantA);

      await expect(
        ReviewService.correctField(
          'DOC-INVALID-FIELD',
          tenantA,
          'unknown_field_xyz',
          { correctedValue: 'abc' },
          mockUser
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'FIELD_NOT_FOUND',
      });
    });
  });

  describe('Review Workflow Decisions (submitReviewDecision)', () => {
    it('should transition document status to APPROVED and stage REVIEW_COMPLETED on APPROVE', async () => {
      setupDocument('DOC-APPROVE', tenantA);

      const decision = await ReviewService.submitReviewDecision(
        'DOC-APPROVE',
        tenantA,
        { action: 'APPROVE', comments: 'All line items and totals verified.' },
        mockUser
      );

      expect(decision.status).toBe('APPROVED');
      expect(decision.stage).toBe('REVIEW_COMPLETED');
      expect(decision.auditEvent.action).toBe('APPROVE');
      expect(decision.auditEvent.actor).toBe(mockUser.email);

      const doc = await IntakeService.getDocument('DOC-APPROVE', tenantA);
      expect(doc?.status).toBe('APPROVED');
    });

    it('should transition document status to REJECTED on REJECT', async () => {
      setupDocument('DOC-REJECT', tenantA);

      const decision = await ReviewService.submitReviewDecision(
        'DOC-REJECT',
        tenantA,
        { action: 'REJECT', comments: 'Illegible scan and missing vendor header.' },
        mockUser
      );

      expect(decision.status).toBe('REJECTED');
      expect(decision.stage).toBe('REVIEW_REJECTED');
    });

    it('should transition document status to CHANGES_REQUESTED on REQUEST_CHANGES', async () => {
      setupDocument('DOC-FLAG', tenantA);

      const decision = await ReviewService.submitReviewDecision(
        'DOC-FLAG',
        tenantA,
        { action: 'REQUEST_CHANGES', comments: 'Vendor name mismatch against purchase order.' },
        mockUser
      );

      expect(decision.status).toBe('NEEDS_REVIEW');
      expect(decision.stage).toBe('CHANGES_REQUESTED');
    });

    it('should reject invalid action with 400 INVALID_ACTION', async () => {
      setupDocument('DOC-INVALID-ACT', tenantA);

      await expect(
        ReviewService.submitReviewDecision(
          'DOC-INVALID-ACT',
          tenantA,
          { action: 'INVALID_ACTION' as any },
          mockUser
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_ACTION',
      });
    });
  });

  describe('Audit Trail (getAuditLogs)', () => {
    it('should record and retrieve all workflow actions in chronological audit trail', async () => {
      setupDocument('DOC-AUDIT-TRAIL', tenantA);
      setupExtraction('DOC-AUDIT-TRAIL', tenantA, 100, 20, 120);

      await ReviewService.correctField(
        'DOC-AUDIT-TRAIL',
        tenantA,
        'invoice_number',
        { correctedValue: 'INV-NEW' },
        mockUser
      );

      await ReviewService.submitReviewDecision(
        'DOC-AUDIT-TRAIL',
        tenantA,
        { action: 'APPROVE', comments: 'Approved after edit.' },
        mockUser
      );

      const logs = await ReviewService.getAuditLogs('DOC-AUDIT-TRAIL', tenantA);
      expect(logs.length).toBe(2);
      expect(logs[0].action).toBe('FIELD_CORRECTION');
      expect(logs[1].action).toBe('APPROVE');
    });
  });
});
