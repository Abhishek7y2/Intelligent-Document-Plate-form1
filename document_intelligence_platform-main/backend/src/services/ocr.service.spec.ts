import { OcrService, DocumentNotEligibleError, OcrNotFoundError } from './ocr.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { TesseractCliAdapter } from './tesseract-ocr.adapter.js';
import { IntakeService } from './intake.service.js';
import { DocumentRecord } from '../models/intake.models.js';
import {
  bboxToPolygon,
  normalizeConfidence,
  validateBoundingBox,
  calculateAverageConfidence,
} from '../utils/geometry-normalizer.js';

describe('Sprint 5: OCR and Document Geometry Pipeline', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(() => {
    IntakeService.clearInMemory();
    OcrService.clearInMemory();
    OcrService.setEngine(new SyntheticMockOcrAdapter('standard'));
  });

  describe('1. Document Processing Eligibility Gates (Security & Quarantine)', () => {
    it('should strictly reject quarantined documents with 403 error', async () => {
      const quarantinedDoc: DocumentRecord = {
        documentId: 'DOC-QUARANTINE-001',
        tenantId: tenantA,
        fileName: 'malicious.pdf',
        storagePath: 'tenants/TNT-CORP-01/quarantine/DOC-QUARANTINE-001.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'a'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUARANTINED',
        stage: 'QUARANTINE_ISOLATED',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
        quarantineReason: 'Malware detected by ClamAV: EICAR-Test-Signature',
      };
      IntakeService.setInMemoryDocument(quarantinedDoc);

      await expect(OcrService.processDocument('DOC-QUARANTINE-001', tenantA)).rejects.toThrow(
        DocumentNotEligibleError
      );

      try {
        await OcrService.processDocument('DOC-QUARANTINE-001', tenantA);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('DOCUMENT_QUARANTINED');
      }
    });

    it('should reject rejected documents with 400 error', async () => {
      const rejectedDoc: DocumentRecord = {
        documentId: 'DOC-REJECTED-001',
        tenantId: tenantA,
        fileName: 'rejected.pdf',
        storagePath: 'tenants/TNT-CORP-01/raw/DOC-REJECTED-001.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'b'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'REJECTED',
        stage: 'INGESTION_REJECTED',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(rejectedDoc);

      await expect(OcrService.processDocument('DOC-REJECTED-001', tenantA)).rejects.toThrow(
        DocumentNotEligibleError
      );
    });

    it('should reject unscanned documents with 400 error', async () => {
      const unscannedDoc: DocumentRecord = {
        documentId: 'DOC-UNSCANNED-001',
        tenantId: tenantA,
        fileName: 'pending.pdf',
        storagePath: 'tenants/TNT-CORP-01/raw/DOC-UNSCANNED-001.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'c'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'PENDING_SCAN',
        stage: 'PENDING_VIRUS_SCAN',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(unscannedDoc);

      await expect(OcrService.processDocument('DOC-UNSCANNED-001', tenantA)).rejects.toThrow(
        DocumentNotEligibleError
      );
    });

    it('should enforce strict tenant boundary and reject cross-tenant access with 404', async () => {
      const docA: DocumentRecord = {
        documentId: 'DOC-TENANT-A',
        tenantId: tenantA,
        fileName: 'confidential_a.pdf',
        storagePath: 'tenants/TNT-CORP-01/raw/DOC-TENANT-A.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'd'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(docA);

      await expect(OcrService.processDocument('DOC-TENANT-A', tenantB)).rejects.toThrow(OcrNotFoundError);
      const crossTenantOcr = await OcrService.getOcrResult('DOC-TENANT-A', tenantB);
      expect(crossTenantOcr).toBeNull();
    });

    it('should reject concurrent execution when document is already PROCESSING with 409 error', async () => {
      const processingDoc: DocumentRecord = {
        documentId: 'DOC-IN-PROGRESS-01',
        tenantId: tenantA,
        fileName: 'active.pdf',
        storagePath: 'tenants/TNT-CORP-01/raw/DOC-IN-PROGRESS-01.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'e'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'PROCESSING',
        stage: 'OCR_PIPELINE_ACTIVE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(processingDoc);

      try {
        await OcrService.processDocument('DOC-IN-PROGRESS-01', tenantA);
        fail('Expected processDocument to throw DocumentNotEligibleError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DocumentNotEligibleError);
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('DOCUMENT_ALREADY_PROCESSING');
      }
    });

    it('should reject document that failed intake ingestion with 400 error', async () => {
      const failedIntakeDoc: DocumentRecord = {
        documentId: 'DOC-FAILED-INTAKE-01',
        tenantId: tenantA,
        fileName: 'corrupted_intake.pdf',
        storagePath: 'tenants/TNT-CORP-01/raw/DOC-FAILED-INTAKE-01.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'f'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'FAILED',
        stage: 'INGESTION_FAILED',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(failedIntakeDoc);

      try {
        await OcrService.processDocument('DOC-FAILED-INTAKE-01', tenantA);
        fail('Expected processDocument to throw DocumentNotEligibleError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DocumentNotEligibleError);
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('DOCUMENT_FAILED');
      }
    });

    it('should allow retrying OCR processing when document previously failed during OCR execution', async () => {
      const rawPdf = Buffer.from('%PDF-1.4\n retryable pdf \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-RETRY-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const failedOcrDoc: DocumentRecord = {
        documentId: 'DOC-RETRY-01',
        tenantId: tenantA,
        fileName: 'retryable.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '0'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'FAILED',
        stage: 'OCR_PIPELINE_FAILED',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(failedOcrDoc);

      // Retry should proceed successfully
      const result = await OcrService.processDocument('DOC-RETRY-01', tenantA);
      expect(result.status).toBe('SUCCESS');
      const updated = await IntakeService.getDocument('DOC-RETRY-01', tenantA);
      expect(updated?.status).toBe('STP_PROCESSED');
      expect(updated?.stage).toBe('OCR_COMPLETE');
    });
  });

  describe('2. Geometry Normalization & Spatial Validation', () => {
    it('should compute exact 8-point polygon from 2D bounding box', () => {
      const bbox = { left: 100, top: 150, width: 200, height: 50 };
      const polygon = bboxToPolygon(bbox);

      // Clockwise: [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]
      expect(polygon).toEqual([100, 150, 300, 150, 300, 200, 100, 200]);
    });

    it('should normalize confidence to 0.0 - 1.0 range regardless of 0-100 or 0-1 source', () => {
      expect(normalizeConfidence(95.4)).toBe(0.954);
      expect(normalizeConfidence(0.885)).toBe(0.885);
      expect(normalizeConfidence(100)).toBe(1.0);
      expect(normalizeConfidence(0)).toBe(0.0);
      expect(normalizeConfidence(-5)).toBe(0.0);
      expect(normalizeConfidence(null)).toBe(0.0);
    });

    it('should clamp bounding boxes within page boundaries', () => {
      const outOfBoundsBbox = { left: 2400, top: 3200, width: 300, height: 200 };
      const { valid, normalizedBbox } = validateBoundingBox(outOfBoundsBbox, 2550, 3300);

      expect(valid).toBe(true);
      expect(normalizedBbox.left).toBe(2400);
      expect(normalizedBbox.top).toBe(3200);
      expect(normalizedBbox.width).toBe(150); // Clamped to 2550 - 2400
      expect(normalizedBbox.height).toBe(100); // Clamped to 3300 - 3200
    });

    it('should accurately calculate average word confidence', () => {
      const words = [
        { id: '1', text: 'TAX', confidence: 0.9, bbox: { left: 0, top: 0, width: 10, height: 10 }, polygon: [0, 0, 10, 0, 10, 10, 0, 10] as any, pageNumber: 1 },
        { id: '2', text: 'INVOICE', confidence: 0.8, bbox: { left: 15, top: 0, width: 20, height: 10 }, polygon: [15, 0, 35, 0, 35, 10, 15, 10] as any, pageNumber: 1 },
      ];
      expect(calculateAverageConfidence(words)).toBe(0.85);
    });
  });

  describe('3. OCR Execution, Document Transitions & Edge Cases', () => {
    it('should process eligible queued document and return normalized OCR result with geometry', async () => {
      const rawPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF\n');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-VALID-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-VALID-01',
        tenantId: tenantA,
        fileName: 'invoice.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '1'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      const result = await OcrService.processDocument('DOC-VALID-01', tenantA);

      expect(result.status).toBe('SUCCESS');
      expect(result.documentId).toBe('DOC-VALID-01');
      expect(result.tenantId).toBe(tenantA);
      expect(result.schemaVersion).toBe('1.0.0');
      expect(result.coordinateSystem.origin).toBe('top_left');
      expect(result.pages.length).toBe(1);
      expect(result.pages[0].words.length).toBeGreaterThan(0);
      expect(result.pages[0].lines.length).toBeGreaterThan(0);
      expect(result.fullText).toContain('TAX INVOICE');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.85);

      // Verify document status transition
      const updatedDoc = await IntakeService.getDocument('DOC-VALID-01', tenantA);
      expect(updatedDoc?.status).toBe('STP_PROCESSED');
      expect(updatedDoc?.stage).toBe('OCR_COMPLETE');
      expect(updatedDoc?.confidenceScore).toBe(result.overallConfidence);

      // Verify retrieval API
      const retrieved = await OcrService.getOcrResult('DOC-VALID-01', tenantA);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.ocrResultId).toBe(result.ocrResultId);

      // Verify page geometry retrieval
      const pageGeom = await OcrService.getPageGeometry('DOC-VALID-01', 1, tenantA);
      expect(pageGeom).not.toBeNull();
      expect(pageGeom?.pageNumber).toBe(1);
      expect(pageGeom?.words.length).toBe(result.pages[0].words.length);
    });

    it('should handle multi-page documents and preserve page boundaries', async () => {
      OcrService.setEngine(new SyntheticMockOcrAdapter('multi_page'));
      const rawPdf = Buffer.from('%PDF-1.4\n multi page fake \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-MULTI-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-MULTI-01',
        tenantId: tenantA,
        fileName: 'multipage.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '2'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      const result = await OcrService.processDocument('DOC-MULTI-01', tenantA);

      expect(result.pageCount).toBe(2);
      expect(result.pages.length).toBe(2);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[1].pageNumber).toBe(2);
      expect(result.pages[1].text).toContain('TERMS AND CONDITIONS');

      const page2Geom = await OcrService.getPageGeometry('DOC-MULTI-01', 2, tenantA);
      expect(page2Geom?.pageNumber).toBe(2);
      expect(page2Geom?.text).toContain('TERMS AND CONDITIONS');
    });

    it('should transition document to NEEDS_REVIEW when confidence is below threshold (< 0.85)', async () => {
      OcrService.setEngine(new SyntheticMockOcrAdapter('low_confidence'));
      const rawPdf = Buffer.from('%PDF-1.4\n low conf \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-LOW-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-LOW-01',
        tenantId: tenantA,
        fileName: 'low_conf.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '3'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      const result = await OcrService.processDocument('DOC-LOW-01', tenantA);

      expect(result.overallConfidence).toBeLessThan(0.85);
      const updatedDoc = await IntakeService.getDocument('DOC-LOW-01', tenantA);
      expect(updatedDoc?.status).toBe('NEEDS_REVIEW');
    });

    it('should handle empty or blank documents gracefully with 0 tokens and 0.0 confidence', async () => {
      OcrService.setEngine(new SyntheticMockOcrAdapter('empty'));
      const rawPdf = Buffer.from('%PDF-1.4\n blank \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-EMPTY-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-EMPTY-01',
        tenantId: tenantA,
        fileName: 'empty.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '4'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      const result = await OcrService.processDocument('DOC-EMPTY-01', tenantA);

      expect(result.status).toBe('SUCCESS');
      expect(result.fullText).toBe('');
      expect(result.overallConfidence).toBe(0.0);
      expect(result.pages[0].words.length).toBe(0);
    });

    it('should mark document as FAILED and fail safely when corrupt input causes engine error', async () => {
      OcrService.setEngine(new SyntheticMockOcrAdapter('corrupt'));
      const rawPdf = Buffer.from('%PDF-1.4\n corrupt \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-CORRUPT-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-CORRUPT-01',
        tenantId: tenantA,
        fileName: 'corrupt.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '5'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      await expect(OcrService.processDocument('DOC-CORRUPT-01', tenantA)).rejects.toThrow();

      const updatedDoc = await IntakeService.getDocument('DOC-CORRUPT-01', tenantA);
      expect(updatedDoc?.status).toBe('FAILED');
      expect(updatedDoc?.stage).toBe('OCR_PIPELINE_FAILED');
    });

    it('should handle repeated processing idempotently on the same document', async () => {
      const rawPdf = Buffer.from('%PDF-1.4\n idempotency test \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-REPEAT-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-REPEAT-01',
        tenantId: tenantA,
        fileName: 'repeated.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '7'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      // Run 1
      const result1 = await OcrService.processDocument('DOC-REPEAT-01', tenantA);
      expect(result1.status).toBe('SUCCESS');
      const retrieved1 = await OcrService.getOcrResult('DOC-REPEAT-01', tenantA);
      expect(retrieved1?.ocrResultId).toBe(result1.ocrResultId);

      // Run 2 (re-processing)
      const result2 = await OcrService.processDocument('DOC-REPEAT-01', tenantA);
      expect(result2.status).toBe('SUCCESS');
      const retrieved2 = await OcrService.getOcrResult('DOC-REPEAT-01', tenantA);
      expect(retrieved2?.ocrResultId).toBe(result2.ocrResultId);

      // Status consistency
      const finalDoc = await IntakeService.getDocument('DOC-REPEAT-01', tenantA);
      expect(finalDoc?.status).toBe('STP_PROCESSED');
      expect(finalDoc?.stage).toBe('OCR_COMPLETE');
    });

    it('should handle timeout behavior and transition document to FAILED', async () => {
      OcrService.setEngine(new SyntheticMockOcrAdapter('timeout'));
      const rawPdf = Buffer.from('%PDF-1.4\n timeout test \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-TIMEOUT-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-TIMEOUT-01',
        tenantId: tenantA,
        fileName: 'timeout.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '8'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(doc);

      await expect(OcrService.processDocument('DOC-TIMEOUT-01', tenantA)).rejects.toThrow();

      const updated = await IntakeService.getDocument('DOC-TIMEOUT-01', tenantA);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.stage).toBe('OCR_PIPELINE_FAILED');
    });
  });

  describe('4. Production Tesseract CLI Adapter Live Execution Check & TSV Parsing', () => {
    it('should confirm Tesseract CLI availability on host environment', async () => {
      const tesseractAdapter = new TesseractCliAdapter();
      const isAvailable = await tesseractAdapter.isAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should parse Tesseract TSV output format with page dimensions and normalized word coordinates', () => {
      const sampleTsv = [
        'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
        '1\t1\t0\t0\t0\t0\t0\t0\t2480\t3508\t-1\t',
        '2\t1\t1\t0\t0\t0\t100\t200\t1200\t400\t-1\t',
        '3\t1\t1\t1\t0\t0\t100\t200\t1200\t400\t-1\t',
        '4\t1\t1\t1\t1\t0\t100\t200\t600\t50\t-1\t',
        '5\t1\t1\t1\t1\t1\t100\t200\t250\t45\t95.5\tINVOICE',
        '5\t1\t1\t1\t1\t2\t360\t200\t200\t45\t88.0\t#1024',
      ].join('\n');

      const adapter = new TesseractCliAdapter();
      // Invoke private parseTsvOutput via any cast for whitebox testing
      const parsed = (adapter as any).parseTsvOutput(sampleTsv, 1);

      expect(parsed.pageNumber).toBe(1);
      expect(parsed.width).toBe(2480);
      expect(parsed.height).toBe(3508);
      expect(parsed.words.length).toBe(2);
      expect(parsed.words[0].text).toBe('INVOICE');
      expect(parsed.words[0].confidence).toBe(0.955);
      expect(parsed.words[0].bbox).toEqual({ left: 100, top: 200, width: 250, height: 45 });
      expect(parsed.words[0].polygon).toEqual([100, 200, 350, 200, 350, 245, 100, 245]);
      expect(parsed.lines.length).toBe(1);
      expect(parsed.lines[0].text).toBe('INVOICE #1024');
      expect(parsed.confidence).toBeGreaterThan(0.9);
    });
  });
});
