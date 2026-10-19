import { OcrService, DocumentNotEligibleError, OcrNotFoundError } from './ocr.service.js';
import { IntakeService } from './intake.service.js';
import { MemoryStorageService } from './storage.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';

describe('DEF-PERF-01 Regression Suite: OCR & Object Storage Integrity', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';
  const validPdfBytes = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n175\n%%EOF'
  );

  let storage: MemoryStorageService;

  beforeEach(() => {
    storage = new MemoryStorageService();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();
    IntakeService.setStorage(storage);
    OcrService.setStoreMode('memory');
    OcrService.clearInMemory();
    OcrService.setEngine(new SyntheticMockOcrAdapter());
    delete process.env['ALLOW_SYNTHETIC_OCR_FIXTURES'];
  });

  it('1. should process existing valid stored object successfully', async () => {
    const storagePath = '/tenants/TNT-CORP-01/valid_invoice.pdf';
    await storage.putObject(storagePath, validPdfBytes);

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-VALID-01',
      tenantId: tenantA,
      fileName: 'valid_invoice.pdf',
      storagePath,
      fileSizeBytes: validPdfBytes.length,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-valid-01',
      documentType: 'Purchase Invoice',
      status: 'QUEUED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    const result = await OcrService.processDocument('DOC-VALID-01', tenantA);
    expect(result).toBeDefined();
    expect(result.documentId).toBe('DOC-VALID-01');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);

    const doc = await IntakeService.getDocument('DOC-VALID-01', tenantA);
    expect(doc?.status).toBe('STP_PROCESSED');
    expect(doc?.stage).toBe('OCR_COMPLETE');
  });

  it('2. should fail safely with 404 when storage key is missing without fabricating data in production mode', async () => {
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-ORPHAN-01',
      tenantId: tenantA,
      fileName: 'missing_payload.pdf',
      storagePath: '/tenants/TNT-CORP-01/non_existent.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-orphan-01',
      documentType: 'Purchase Invoice',
      status: 'QUEUED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    await expect(OcrService.processDocument('DOC-ORPHAN-01', tenantA)).rejects.toThrow(DocumentNotEligibleError);

    try {
      await OcrService.processDocument('DOC-ORPHAN-01', tenantA);
    } catch (err: any) {
      // Must not be an unhandled 500 error; must be a controlled 404 problem detail
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('STORAGE_PAYLOAD_NOT_FOUND');
    }

    // Document must be marked FAILED rather than permanently locked in PROCESSING
    const doc = await IntakeService.getDocument('DOC-ORPHAN-01', tenantA);
    expect(doc?.status).toBe('FAILED');
    expect(doc?.stage).toBe('OCR_PIPELINE_FAILED');
  });

  it('3. should enforce strict tenant boundary and reject cross-tenant document processing', async () => {
    await storage.putObject('/tenants/TNT-CORP-02/tenant_b_doc.pdf', validPdfBytes);

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-TENANT-B',
      tenantId: tenantB,
      fileName: 'tenant_b_doc.pdf',
      storagePath: '/tenants/TNT-CORP-02/tenant_b_doc.pdf',
      fileSizeBytes: validPdfBytes.length,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-tenant-b',
      documentType: 'Internal Policy',
      status: 'QUEUED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 2,
      uploadedAt: new Date(),
    });

    // Tenant A attempts to process Tenant B's document
    await expect(OcrService.processDocument('DOC-TENANT-B', tenantA)).rejects.toThrow(OcrNotFoundError);
  });

  it('4. should reject duplicate processing request with 409 when document is already undergoing processing', async () => {
    await storage.putObject('/tenants/TNT-CORP-01/in_flight.pdf', validPdfBytes);

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-PROCESSING-01',
      tenantId: tenantA,
      fileName: 'in_flight.pdf',
      storagePath: '/tenants/TNT-CORP-01/in_flight.pdf',
      fileSizeBytes: validPdfBytes.length,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-processing-01',
      documentType: 'Purchase Invoice',
      status: 'PROCESSING',
      stage: 'OCR_PIPELINE_ACTIVE',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    await expect(OcrService.processDocument('DOC-PROCESSING-01', tenantA)).rejects.toThrow(DocumentNotEligibleError);
    try {
      await OcrService.processDocument('DOC-PROCESSING-01', tenantA);
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('DOCUMENT_ALREADY_PROCESSING');
    }
  });

  it('5. should reject quarantined documents and prohibit entry into OCR pipeline', async () => {
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-INFECTED-01',
      tenantId: tenantA,
      fileName: 'malicious.pdf',
      storagePath: '/quarantine/malicious.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      sha256Hash: 'malware-hash',
      documentType: 'Purchase Invoice',
      status: 'QUARANTINED',
      stage: 'QUARANTINED',
      confidenceScore: null,
      slaStatus: 'BREACHED',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
      quarantineReason: 'Trojan.PDF.Dropper.Gen',
    });

    await expect(OcrService.processDocument('DOC-INFECTED-01', tenantA)).rejects.toThrow(DocumentNotEligibleError);
    try {
      await OcrService.processDocument('DOC-INFECTED-01', tenantA);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('DOCUMENT_QUARANTINED');
    }
  });

  it('6. should allow controlled synthetic fallback ONLY when explicitly enabled by test configuration', async () => {
    process.env['ALLOW_SYNTHETIC_OCR_FIXTURES'] = 'true';

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-SYNTHETIC-FIXTURE',
      tenantId: tenantA,
      fileName: 'fixture_without_storage.pdf',
      storagePath: '/tenants/TNT-CORP-01/fixture_without_storage.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-synthetic-01',
      documentType: 'Purchase Invoice',
      status: 'QUEUED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    const result = await OcrService.processDocument('DOC-SYNTHETIC-FIXTURE', tenantA);
    expect(result).toBeDefined();
    expect(result.documentId).toBe('DOC-SYNTHETIC-FIXTURE');
  });
});
