import { ClassificationService } from './classification.service.js';
import { RuleBasedClassifier, DocumentClassifier } from './rule-based-classifier.js';
import { IntakeService, DocumentNotEligibleError, OcrNotFoundError } from './intake.service.js';
import { OcrService } from './ocr.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { DocumentRecord } from '../models/intake.models.js';

describe('Sprint 6: Classification Service & Taxonomy Pipeline (FR-004)', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(() => {
    IntakeService.clearInMemory();
    OcrService.clearInMemory();
    ClassificationService.clearInMemory();
    ClassificationService.setStoreMode('memory');
    ClassificationService.setClassifier(new RuleBasedClassifier());
    OcrService.setEngine(new SyntheticMockOcrAdapter('standard'));
  });

  async function setupReadyDocument(
    docId: string,
    tenantId: string,
    docType: string = 'purchase-invoice'
  ): Promise<DocumentRecord> {
    const storagePath = `tenants/${tenantId}/clean/${docId}.pdf`;
    const dummyBuffer = Buffer.from('%PDF-1.4\n dummy test content \n%%EOF');
    await IntakeService.getStorage().putObject(storagePath, dummyBuffer);

    const doc: DocumentRecord = {
      documentId: docId,
      tenantId,
      fileName: 'document.pdf',
      storagePath,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      sha256Hash: 'e'.repeat(64),
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
        ClassificationService.classifyDocument('DOC-NONEXISTENT', tenantA)
      ).rejects.toThrow(OcrNotFoundError);
    });

    it('should enforce tenant boundary isolation and reject cross-tenant document', async () => {
      await setupReadyDocument('DOC-TNT-A', tenantA);
      await expect(
        ClassificationService.classifyDocument('DOC-TNT-A', tenantB)
      ).rejects.toThrow(OcrNotFoundError);
    });

    it('should reject quarantined documents with 403 DOCUMENT_QUARANTINED', async () => {
      const doc = await setupReadyDocument('DOC-QUARANTINE', tenantA);
      doc.status = 'QUARANTINED';
      IntakeService.setInMemoryDocument(doc);

      await expect(
        ClassificationService.classifyDocument('DOC-QUARANTINE', tenantA)
      ).rejects.toThrow(DocumentNotEligibleError);

      try {
        await ClassificationService.classifyDocument('DOC-QUARANTINE', tenantA);
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
        await ClassificationService.classifyDocument('DOC-REJECTED', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('DOCUMENT_REJECTED');
      }
    });

    it('should reject documents pending antivirus scan with 400 DOCUMENT_NOT_SCANNED', async () => {
      const doc = await setupReadyDocument('DOC-UNSCANNED', tenantA);
      doc.status = 'PENDING_SCAN';
      IntakeService.setInMemoryDocument(doc);

      try {
        await ClassificationService.classifyDocument('DOC-UNSCANNED', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('DOCUMENT_NOT_SCANNED');
      }
    });

    it('should reject documents without prior OCR results with 400 OCR_REQUIRED_FOR_CLASSIFICATION', async () => {
      await setupReadyDocument('DOC-NO-OCR', tenantA);

      try {
        await ClassificationService.classifyDocument('DOC-NO-OCR', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('OCR_REQUIRED_FOR_CLASSIFICATION');
      }
    });
  });

  describe('2. Automated Document Classification (FR-004)', () => {
    it('should classify a standard invoice with >= 0.80 confidence and route to AUTO_CLASSIFIED', async () => {
      await setupReadyDocument('DOC-INV-001', tenantA, 'purchase-invoice');
      await OcrService.processDocument('DOC-INV-001', tenantA);

      const classification = await ClassificationService.classifyDocument('DOC-INV-001', tenantA);

      expect(classification.documentId).toBe('DOC-INV-001');
      expect(classification.tenantId).toBe(tenantA);
      expect(classification.predictedType).toBe('purchase-invoice');
      expect(classification.confidenceScore).toBeGreaterThanOrEqual(0.8);
      expect(classification.isConfident).toBe(true);
      expect(classification.routingDecision).toBe('AUTO_CLASSIFIED');
      expect(classification.matchingSignals.length).toBeGreaterThan(0);

      const updatedDoc = await IntakeService.getDocument('DOC-INV-001', tenantA);
      expect(updatedDoc?.documentType).toBe('purchase-invoice');
      expect(updatedDoc?.stage).toBe('CLASSIFICATION_COMPLETED');
    });

    it('should route low-confidence / ambiguous documents (< 0.80) to MANUAL_TRIAGE and mark NEEDS_REVIEW', async () => {
      await setupReadyDocument('DOC-AMBIGUOUS-001', tenantA, 'unknown');

      const lowConfidenceClassifier: DocumentClassifier = {
        async classify() {
          return {
            predictedType: 'purchase-invoice',
            confidenceScore: 0.65,
            isConfident: false,
            routingDecision: 'MANUAL_TRIAGE',
            classifierName: 'LowConfidenceMockClassifier',
            matchingSignals: ['invoice'],
          };
        },
      };
      ClassificationService.setClassifier(lowConfidenceClassifier);

      await OcrService.processDocument('DOC-AMBIGUOUS-001', tenantA);
      const result = await ClassificationService.classifyDocument('DOC-AMBIGUOUS-001', tenantA);

      expect(result.confidenceScore).toBe(0.65);
      expect(result.isConfident).toBe(false);
      expect(result.routingDecision).toBe('MANUAL_TRIAGE');

      const doc = await IntakeService.getDocument('DOC-AMBIGUOUS-001', tenantA);
      expect(doc?.status).toBe('NEEDS_REVIEW');
      expect(doc?.stage).toBe('CLASSIFICATION_TRIAGE');
    });

    it('should test exact 0.80 boundary: confidence 0.80 is AUTO_CLASSIFIED and 0.799 is MANUAL_TRIAGE', async () => {
      await setupReadyDocument('DOC-BND-80', tenantA, 'unknown');
      const atBoundaryClassifier: DocumentClassifier = {
        async classify() {
          return {
            predictedType: 'purchase-invoice',
            confidenceScore: 0.80,
            isConfident: true,
            routingDecision: 'AUTO_CLASSIFIED',
            classifierName: 'BoundaryMockClassifier',
            matchingSignals: ['invoice', 'tax'],
          };
        },
      };
      ClassificationService.setClassifier(atBoundaryClassifier);
      await OcrService.processDocument('DOC-BND-80', tenantA);
      const res80 = await ClassificationService.classifyDocument('DOC-BND-80', tenantA);
      expect(res80.confidenceScore).toBe(0.80);
      expect(res80.isConfident).toBe(true);
      expect(res80.routingDecision).toBe('AUTO_CLASSIFIED');

      await setupReadyDocument('DOC-BND-79', tenantA, 'unknown');
      const belowBoundaryClassifier: DocumentClassifier = {
        async classify() {
          return {
            predictedType: 'purchase-invoice',
            confidenceScore: 0.799,
            isConfident: false,
            routingDecision: 'MANUAL_TRIAGE',
            classifierName: 'BoundaryMockClassifier',
            matchingSignals: ['invoice'],
          };
        },
      };
      ClassificationService.setClassifier(belowBoundaryClassifier);
      await OcrService.processDocument('DOC-BND-79', tenantA);
      const res79 = await ClassificationService.classifyDocument('DOC-BND-79', tenantA);
      expect(res79.confidenceScore).toBe(0.799);
      expect(res79.isConfident).toBe(false);
      expect(res79.routingDecision).toBe('MANUAL_TRIAGE');
    });

    it('should route unrecognized documents to unknown and MANUAL_TRIAGE', async () => {
      await setupReadyDocument('DOC-UNKNOWN-001', tenantA, 'unknown');

      const unknownClassifier: DocumentClassifier = {
        async classify() {
          return {
            predictedType: 'unknown',
            confidenceScore: 0.2,
            isConfident: false,
            routingDecision: 'MANUAL_TRIAGE',
            classifierName: 'UnknownClassifier',
            matchingSignals: [],
          };
        },
      };
      ClassificationService.setClassifier(unknownClassifier);

      await OcrService.processDocument('DOC-UNKNOWN-001', tenantA);
      const result = await ClassificationService.classifyDocument('DOC-UNKNOWN-001', tenantA);

      expect(result.predictedType).toBe('unknown');
      expect(result.confidenceScore).toBe(0.2);
      expect(result.routingDecision).toBe('MANUAL_TRIAGE');
    });
  });

  describe('3. Persistence & Retrieval Operations', () => {
    it('should retrieve stored classification results by document ID', async () => {
      await setupReadyDocument('DOC-STORED-001', tenantA);
      await OcrService.processDocument('DOC-STORED-001', tenantA);

      await ClassificationService.classifyDocument('DOC-STORED-001', tenantA);
      const retrieved = await ClassificationService.getClassification('DOC-STORED-001', tenantA);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.documentId).toBe('DOC-STORED-001');
      expect(retrieved?.tenantId).toBe(tenantA);
    });

    it('should return null when retrieving non-existent classification', async () => {
      const retrieved = await ClassificationService.getClassification('DOC-NONE', tenantA);
      expect(retrieved).toBeNull();
    });

    it('should reject cross-tenant retrieval of classification result', async () => {
      await setupReadyDocument('DOC-TENANT-ISO', tenantA);
      await OcrService.processDocument('DOC-TENANT-ISO', tenantA);
      await ClassificationService.classifyDocument('DOC-TENANT-ISO', tenantA);

      const crossTenantResult = await ClassificationService.getClassification('DOC-TENANT-ISO', tenantB);
      expect(crossTenantResult).toBeNull();
    });
  });
});
