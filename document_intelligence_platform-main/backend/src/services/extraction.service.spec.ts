import { ExtractionService } from './extraction.service.js';
import { IntakeService, OcrNotFoundError } from './intake.service.js';
import { OcrService } from './ocr.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { DocumentRecord } from '../models/intake.models.js';
import { FieldExtractor } from './template-driven-extractor.js';
import { reconcileInvoiceAmounts } from '../utils/invoice-math-reconciler.js';

describe('Sprint 6: Field Extraction, Math Reconciliation, and Evidence Pipeline (FR-005, FR-006, FR-007, FR-008)', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(() => {
    IntakeService.clearInMemory();
    OcrService.clearInMemory();
    ExtractionService.clearInMemory();
    ExtractionService.setStoreMode('memory');
    OcrService.setEngine(new SyntheticMockOcrAdapter('standard'));
  });

  async function setupReadyDocument(
    docId: string,
    tenantId: string,
    docType: string = 'purchase-invoice'
  ): Promise<DocumentRecord> {
    const storagePath = `tenants/${tenantId}/clean/${docId}.pdf`;
    const dummyBuffer = Buffer.from('%PDF-1.4\n synthetic sample pdf payload \n%%EOF');
    await IntakeService.getStorage().putObject(storagePath, dummyBuffer);

    const doc: DocumentRecord = {
      documentId: docId,
      tenantId,
      fileName: 'invoice.pdf',
      storagePath,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      sha256Hash: 'f'.repeat(64),
      documentType: docType,
      status: 'QUEUED',
      stage: 'INGESTION_COMPLETED',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    };
    IntakeService.setInMemoryDocument(doc);
    return doc;
  }

  describe('1. Document Eligibility and Security Isolation Gates', () => {
    it('should strictly reject non-existent document with 404 OcrNotFoundError', async () => {
      await expect(
        ExtractionService.extractDocument('DOC-NONEXISTENT', tenantA)
      ).rejects.toThrow(OcrNotFoundError);
    });

    it('should enforce tenant boundary isolation and reject cross-tenant document', async () => {
      await setupReadyDocument('DOC-TNT-A', tenantA);
      await expect(
        ExtractionService.extractDocument('DOC-TNT-A', tenantB)
      ).rejects.toThrow(OcrNotFoundError);
    });

    it('should reject quarantined documents with 403 DOCUMENT_QUARANTINED', async () => {
      const doc = await setupReadyDocument('DOC-QUARANTINE', tenantA);
      doc.status = 'QUARANTINED';
      IntakeService.setInMemoryDocument(doc);

      try {
        await ExtractionService.extractDocument('DOC-QUARANTINE', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('DOCUMENT_QUARANTINED');
      }
    });

    it('should reject rejected documents with 400 DOCUMENT_REJECTED', async () => {
      const doc = await setupReadyDocument('DOC-REJECTED', tenantA);
      doc.status = 'REJECTED';
      IntakeService.setInMemoryDocument(doc);

      try {
        await ExtractionService.extractDocument('DOC-REJECTED', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('DOCUMENT_REJECTED');
      }
    });

    it('should reject documents without prior OCR results with 400 OCR_REQUIRED_FOR_EXTRACTION', async () => {
      await setupReadyDocument('DOC-NO-OCR', tenantA);

      try {
        await ExtractionService.extractDocument('DOC-NO-OCR', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('OCR_REQUIRED_FOR_EXTRACTION');
      }
    });

    it('should reject documents with unconfigured template schema with 400 or 404', async () => {
      await setupReadyDocument('DOC-UNCONFIGURED', tenantA, 'unregistered-type-xyz');
      await OcrService.processDocument('DOC-UNCONFIGURED', tenantA);

      try {
        await ExtractionService.extractDocument('DOC-UNCONFIGURED', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('2. Layout-Aware Field Extraction & Evidence Grounding (FR-005, FR-006)', () => {
    it('should extract fields for purchase invoice and link grounded bounding boxes and polygons', async () => {
      await setupReadyDocument('DOC-EXTRACT-INV', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-EXTRACT-INV', tenantA);

      const result = await ExtractionService.extractDocument('DOC-EXTRACT-INV', tenantA);

      expect(result.documentId).toBe('DOC-EXTRACT-INV');
      expect(result.documentType).toBe('purchase-invoice');
      expect(result.templateVersion).toBe('v2.1');
      expect(result.fields.length).toBeGreaterThan(0);

      const invNumField = result.fields.find((f) => f.fieldName === 'invoice_number');
      expect(invNumField).toBeDefined();
      expect(invNumField?.extractedValue).toBe('INV-2026-9941');
      expect(invNumField?.confidence).toBeGreaterThan(0.8);
      expect(invNumField?.groundedEvidence).toBeDefined();
      expect(invNumField?.groundedEvidence?.pageNumber).toBe(1);
      expect(invNumField?.groundedEvidence?.boundingBox).toBeDefined();
      expect(invNumField?.groundedEvidence?.polygon).toHaveLength(8);

      const totalField = result.fields.find((f) => f.fieldName === 'total_amount');
      expect(totalField).toBeDefined();
      expect(totalField?.extractedValue).toBe(14500);
    });

    it('should extract fields for supplier-contract template (v1.4)', async () => {
      await setupReadyDocument('DOC-EXTRACT-CTR', tenantA, 'supplier-contract');
      OcrService.setEngine(new SyntheticMockOcrAdapter('contract'));
      await OcrService.processDocument('DOC-EXTRACT-CTR', tenantA);

      const result = await ExtractionService.extractDocument('DOC-EXTRACT-CTR', tenantA);

      expect(result.documentType).toBe('supplier-contract');
      expect(result.templateVersion).toBe('v1.4');

      const ctrNumField = result.fields.find((f) => f.fieldName === 'contract_number');
      expect(ctrNumField?.extractedValue).toBe('CTR-2026-8801');
      expect(ctrNumField?.groundedEvidence?.polygon).toHaveLength(8);

      const valField = result.fields.find((f) => f.fieldName === 'contract_value');
      expect(valField?.extractedValue).toBe(500000);
    });

    it('should extract fields for internal-policy template (v4.2)', async () => {
      await setupReadyDocument('DOC-EXTRACT-POL', tenantA, 'internal-policy');
      OcrService.setEngine(new SyntheticMockOcrAdapter('policy'));
      await OcrService.processDocument('DOC-EXTRACT-POL', tenantA);

      const result = await ExtractionService.extractDocument('DOC-EXTRACT-POL', tenantA);

      expect(result.documentType).toBe('internal-policy');
      expect(result.templateVersion).toBe('v4.2');

      const polNumField = result.fields.find((f) => f.fieldName === 'policy_number');
      expect(polNumField?.extractedValue).toBe('POL-2026-004');
    });

    it('should verify grounded visual evidence coordinate validity within page dimensions', async () => {
      await setupReadyDocument('DOC-EVID-GEOM', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-EVID-GEOM', tenantA);

      const result = await ExtractionService.extractDocument('DOC-EVID-GEOM', tenantA);
      const invNum = result.fields.find((f) => f.fieldName === 'invoice_number');
      const evidence = invNum?.groundedEvidence;

      expect(evidence).toBeDefined();
      expect(evidence?.pageNumber).toBe(1);
      expect(evidence?.boundingBox.left).toBeGreaterThanOrEqual(0);
      expect(evidence?.boundingBox.top).toBeGreaterThanOrEqual(0);
      expect(evidence?.boundingBox.width).toBeGreaterThan(0);
      expect(evidence?.boundingBox.height).toBeGreaterThan(0);
      // Ensure polygon contains 8 points within 300 DPI bounds (width 2550, height 3300)
      for (let i = 0; i < 8; i += 2) {
        expect(evidence?.polygon[i]).toBeLessThanOrEqual(2550);
        expect(evidence?.polygon[i + 1]).toBeLessThanOrEqual(3300);
      }
    });
  });

  describe('3. Invoice Mathematical Reconciliation Engine (FR-007)', () => {
    it('should reconcile matching net + tax == total (|net+tax-total| <= 0.01)', () => {
      const res = reconcileInvoiceAmounts(100.0, 18.0, 118.0);
      expect(res.isReconciled).toBe(true);
      expect(res.delta).toBe(0);
      expect(res.status).toBe('MATCHED');
    });

    it('should reconcile difference exactly equal to 0.01 tolerance boundary', () => {
      const res = reconcileInvoiceAmounts(100.0, 18.0, 118.01);
      expect(res.isReconciled).toBe(true);
      expect(res.delta).toBe(0.01);
      expect(res.status).toBe('MATCHED');
    });

    it('should flag difference slightly exceeding 0.01 boundary (0.015) as MISMATCH', () => {
      const res = reconcileInvoiceAmounts(100.0, 18.0, 118.015);
      expect(res.isReconciled).toBe(false);
      expect(res.delta).toBe(0.015);
      expect(res.status).toBe('MISMATCH');
    });

    it('should correctly reconcile zero values (0 + 0 == 0)', () => {
      const res = reconcileInvoiceAmounts(0.0, 0.0, 0.0);
      expect(res.isReconciled).toBe(true);
      expect(res.delta).toBe(0);
      expect(res.status).toBe('MATCHED');
    });

    it('should reconcile negative adjustments / discount deductions (100 + (-10) == 90)', () => {
      const res = reconcileInvoiceAmounts(100.0, -10.0, 90.0);
      expect(res.isReconciled).toBe(true);
      expect(res.delta).toBe(0);
      expect(res.status).toBe('MATCHED');
    });

    it('should tolerate floating-point boundary rounding within 0.01', () => {
      const res = reconcileInvoiceAmounts(100.004, 18.004, 118.0);
      expect(res.isReconciled).toBe(true);
      expect(res.status).toBe('MATCHED');
    });

    it('should flag reconciliation failure when amounts differ by more than 0.01', () => {
      const res = reconcileInvoiceAmounts(100.0, 18.0, 125.0);
      expect(res.isReconciled).toBe(false);
      expect(res.status).toBe('MISMATCH');
      expect(res.delta).toBe(7.0);
      expect(res.discrepancyReason).toContain('exceeds tolerance of 0.01');
    });

    it('should return INCOMPLETE when one or more components are missing', () => {
      const res1 = reconcileInvoiceAmounts(undefined, 18.0, 118.0);
      expect(res1.isReconciled).toBe(false);
      expect(res1.status).toBe('INCOMPLETE');

      const res2 = reconcileInvoiceAmounts(100.0, undefined, 118.0);
      expect(res2.isReconciled).toBe(false);
      expect(res2.status).toBe('INCOMPLETE');

      const res3 = reconcileInvoiceAmounts(100.0, 18.0, undefined);
      expect(res3.isReconciled).toBe(false);
      expect(res3.status).toBe('INCOMPLETE');

      const resNaN = reconcileInvoiceAmounts(NaN, 18.0, 118.0);
      expect(resNaN.isReconciled).toBe(false);
      expect(resNaN.status).toBe('INCOMPLETE');
    });
  });

  describe('4. Human-In-The-Loop (HITL) Review Routing (FR-008)', () => {
    it('should route to STP_PROCESSED when all fields meet >= 0.85 confidence, required present, math valid', async () => {
      setupReadyDocument('DOC-STP-001', tenantA, 'purchase-invoice');

      const perfectExtractor: FieldExtractor = {
        async extractFields() {
          return [
            {
              fieldId: 'f-1',
              fieldName: 'invoice_number',
              label: 'Invoice Number',
              dataType: 'STRING',
              extractedValue: 'INV-2026-777',
              normalizedValue: 'INV-2026-777',
              confidence: 0.99,
              status: 'EXTRACTED',
              groundedEvidence: {
                pageNumber: 1,
                textSnippet: 'INV-2026-777',
                boundingBox: { left: 10, top: 10, width: 50, height: 20 },
                polygon: [10, 10, 60, 10, 60, 30, 10, 30],
                wordTokens: [],
              },
            },
            {
              fieldId: 'f-2',
              fieldName: 'invoice_date',
              label: 'Invoice Date',
              dataType: 'DATE',
              extractedValue: '2026-05-10',
              normalizedValue: '2026-05-10',
              confidence: 0.98,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-3',
              fieldName: 'supplier_gstin',
              label: 'Supplier GSTIN',
              dataType: 'STRING',
              extractedValue: '29ABCDE1234F1Z5',
              normalizedValue: '29ABCDE1234F1Z5',
              confidence: 0.95,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-4',
              fieldName: 'net_amount',
              label: 'Net Amount',
              dataType: 'CURRENCY',
              extractedValue: 1000.0,
              normalizedValue: 1000.0,
              confidence: 0.97,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-5',
              fieldName: 'tax_amount',
              label: 'Tax Amount',
              dataType: 'CURRENCY',
              extractedValue: 180.0,
              normalizedValue: 180.0,
              confidence: 0.96,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-6',
              fieldName: 'total_amount',
              label: 'Total Amount',
              dataType: 'CURRENCY',
              extractedValue: 1180.0,
              normalizedValue: 1180.0,
              confidence: 0.99,
              status: 'EXTRACTED',
            },
          ];
        },
      };

      ExtractionService.setExtractor(perfectExtractor);
      await setupReadyDocument('DOC-STP-001', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-STP-001', tenantA);

      const result = await ExtractionService.extractDocument('DOC-STP-001', tenantA);

      expect(result.routingDecision).toBe('STP_PROCESSED');
      expect(result.validationSummary.isValid).toBe(true);
      expect(result.validationSummary.reconciliationResult?.isReconciled).toBe(true);

      const doc = await IntakeService.getDocument('DOC-STP-001', tenantA);
      expect(doc?.status).toBe('STP_PROCESSED');
      expect(doc?.stage).toBe('EXTRACTION_STP_COMPLETED');
    });

    it('should route to NEEDS_REVIEW when a field has confidence < 0.85', async () => {
      await setupReadyDocument('DOC-LOWCONF-001', tenantA, 'purchase-invoice');

      const lowConfExtractor: FieldExtractor = {
        async extractFields() {
          return [
            {
              fieldId: 'f-1',
              fieldName: 'invoice_number',
              label: 'Invoice Number',
              dataType: 'STRING',
              extractedValue: 'INV-2026-777',
              normalizedValue: 'INV-2026-777',
              confidence: 0.65,
              status: 'LOW_CONFIDENCE',
              validationErrors: ['Field confidence 0.65 is below threshold 0.85'],
            },
            {
              fieldId: 'f-2',
              fieldName: 'invoice_date',
              label: 'Invoice Date',
              dataType: 'DATE',
              extractedValue: '2026-05-10',
              confidence: 0.95,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-3',
              fieldName: 'total_amount',
              label: 'Total Amount',
              dataType: 'CURRENCY',
              extractedValue: 1000.0,
              confidence: 0.95,
              status: 'EXTRACTED',
            },
          ];
        },
      };

      ExtractionService.setExtractor(lowConfExtractor);
      await OcrService.processDocument('DOC-LOWCONF-001', tenantA);

      const result = await ExtractionService.extractDocument('DOC-LOWCONF-001', tenantA);

      expect(result.routingDecision).toBe('NEEDS_REVIEW');
      expect(result.validationSummary.isValid).toBe(false);
      expect(result.validationSummary.lowConfidenceFields).toContain('invoice_number');

      const doc = await IntakeService.getDocument('DOC-LOWCONF-001', tenantA);
      expect(doc?.status).toBe('NEEDS_REVIEW');
      expect(doc?.stage).toBe('HUMAN_REVIEW_REQUIRED');
    });

    it('should route to NEEDS_REVIEW when arithmetic reconciliation fails (|net+tax-total| > 0.01)', async () => {
      await setupReadyDocument('DOC-MATHFAIL-001', tenantA, 'purchase-invoice');

      const mathFailExtractor: FieldExtractor = {
        async extractFields() {
          return [
            {
              fieldId: 'f-1',
              fieldName: 'invoice_number',
              label: 'Invoice Number',
              dataType: 'STRING',
              extractedValue: 'INV-2026-888',
              confidence: 0.95,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-2',
              fieldName: 'net_amount',
              label: 'Net Amount',
              dataType: 'CURRENCY',
              extractedValue: 1000.0,
              confidence: 0.95,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-3',
              fieldName: 'tax_amount',
              label: 'Tax Amount',
              dataType: 'CURRENCY',
              extractedValue: 180.0,
              confidence: 0.95,
              status: 'EXTRACTED',
            },
            {
              fieldId: 'f-4',
              fieldName: 'total_amount',
              label: 'Total Amount',
              dataType: 'CURRENCY',
              extractedValue: 1500.0,
              confidence: 0.95,
              status: 'EXTRACTED',
            },
          ];
        },
      };

      ExtractionService.setExtractor(mathFailExtractor);
      await OcrService.processDocument('DOC-MATHFAIL-001', tenantA);

      const result = await ExtractionService.extractDocument('DOC-MATHFAIL-001', tenantA);

      expect(result.routingDecision).toBe('NEEDS_REVIEW');
      expect(result.validationSummary.reconciliationResult?.isReconciled).toBe(false);
      expect(result.validationSummary.reconciliationResult?.status).toBe('MISMATCH');

      const doc = await IntakeService.getDocument('DOC-MATHFAIL-001', tenantA);
      expect(doc?.status).toBe('NEEDS_REVIEW');
      expect(doc?.stage).toBe('HUMAN_REVIEW_REQUIRED');
    });

    it('should test exact 0.85 field confidence boundary (0.85 passes STP, 0.849 routes to review)', async () => {
      // 0.85 exactly
      const boundaryPassExtractor: FieldExtractor = {
        async extractFields() {
          return [
            { fieldId: 'f-1', fieldName: 'invoice_number', label: 'Invoice Number', dataType: 'STRING', extractedValue: 'INV-1', confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-2', fieldName: 'invoice_date', label: 'Invoice Date', dataType: 'DATE', extractedValue: '2026-01-01', confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-3', fieldName: 'supplier_gstin', label: 'GSTIN', dataType: 'STRING', extractedValue: '29ABCDE1234F1Z5', confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-4', fieldName: 'net_amount', label: 'Net', dataType: 'CURRENCY', extractedValue: 100, confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-5', fieldName: 'tax_amount', label: 'Tax', dataType: 'CURRENCY', extractedValue: 18, confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-6', fieldName: 'total_amount', label: 'Total', dataType: 'CURRENCY', extractedValue: 118, confidence: 0.85, status: 'EXTRACTED' },
          ];
        },
      };
      ExtractionService.setExtractor(boundaryPassExtractor);
      await setupReadyDocument('DOC-BND-85-PASS', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-BND-85-PASS', tenantA);
      const resPass = await ExtractionService.extractDocument('DOC-BND-85-PASS', tenantA);
      expect(resPass.routingDecision).toBe('STP_PROCESSED');

      // 0.849 fails STP
      const boundaryFailExtractor: FieldExtractor = {
        async extractFields() {
          return [
            { fieldId: 'f-1', fieldName: 'invoice_number', label: 'Invoice Number', dataType: 'STRING', extractedValue: 'INV-1', confidence: 0.849, status: 'LOW_CONFIDENCE' },
            { fieldId: 'f-2', fieldName: 'invoice_date', label: 'Invoice Date', dataType: 'DATE', extractedValue: '2026-01-01', confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-3', fieldName: 'supplier_gstin', label: 'GSTIN', dataType: 'STRING', extractedValue: '29ABCDE1234F1Z5', confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-4', fieldName: 'net_amount', label: 'Net', dataType: 'CURRENCY', extractedValue: 100, confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-5', fieldName: 'tax_amount', label: 'Tax', dataType: 'CURRENCY', extractedValue: 18, confidence: 0.85, status: 'EXTRACTED' },
            { fieldId: 'f-6', fieldName: 'total_amount', label: 'Total', dataType: 'CURRENCY', extractedValue: 118, confidence: 0.85, status: 'EXTRACTED' },
          ];
        },
      };
      ExtractionService.setExtractor(boundaryFailExtractor);
      await setupReadyDocument('DOC-BND-85-FAIL', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-BND-85-FAIL', tenantA);
      const resFail = await ExtractionService.extractDocument('DOC-BND-85-FAIL', tenantA);
      expect(resFail.routingDecision).toBe('NEEDS_REVIEW');
    });

    it('should route to NEEDS_REVIEW when any required field is missing', async () => {
      const missingFieldExtractor: FieldExtractor = {
        async extractFields() {
          return [
            { fieldId: 'f-1', fieldName: 'invoice_number', label: 'Invoice Number', dataType: 'STRING', extractedValue: null, confidence: 0.0, status: 'MISSING' },
            { fieldId: 'f-2', fieldName: 'total_amount', label: 'Total', dataType: 'CURRENCY', extractedValue: 100, confidence: 0.99, status: 'EXTRACTED' },
          ];
        },
      };
      ExtractionService.setExtractor(missingFieldExtractor);
      await setupReadyDocument('DOC-MISS-REQ', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-MISS-REQ', tenantA);
      const res = await ExtractionService.extractDocument('DOC-MISS-REQ', tenantA);
      expect(res.routingDecision).toBe('NEEDS_REVIEW');
      expect(res.validationSummary.missingRequiredFields).toContain('invoice_number');
    });
  });

  describe('5. Persistence and Retrieval Operations', () => {
    it('should retrieve stored extraction results by document ID', async () => {
      await setupReadyDocument('DOC-STORED-EXT', tenantA);
      await OcrService.processDocument('DOC-STORED-EXT', tenantA);

      await ExtractionService.extractDocument('DOC-STORED-EXT', tenantA);
      const retrieved = await ExtractionService.getExtraction('DOC-STORED-EXT', tenantA);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.documentId).toBe('DOC-STORED-EXT');
      expect(retrieved?.tenantId).toBe(tenantA);
    });

    it('should return null when retrieving non-existent extraction', async () => {
      const retrieved = await ExtractionService.getExtraction('DOC-NONE', tenantA);
      expect(retrieved).toBeNull();
    });

    it('should reject cross-tenant retrieval of extraction result', async () => {
      await setupReadyDocument('DOC-TENANT-ISO', tenantA);
      await OcrService.processDocument('DOC-TENANT-ISO', tenantA);
      await ExtractionService.extractDocument('DOC-TENANT-ISO', tenantA);

      const crossTenantResult = await ExtractionService.getExtraction('DOC-TENANT-ISO', tenantB);
      expect(crossTenantResult).toBeNull();
    });
  });
});
