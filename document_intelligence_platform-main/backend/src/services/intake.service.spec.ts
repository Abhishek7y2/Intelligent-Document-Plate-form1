import {
  IntakeService,
  IntakeValidationError,
  MalwareDetectedError,
  DuplicateDocumentError,
} from './intake.service.js';
import { MockMalwareScanner, ScannerUnavailableError, EICAR_TEST_STRING } from './scanner.service.js';
import { MemoryStorageService } from './storage.service.js';

describe('Sprint 4: IntakeService Secure Document Lifecycle', () => {
  const mockStorage = new MemoryStorageService();
  const mockScanner = new MockMalwareScanner('heuristic');

  const validPdfBuffer = Buffer.from('%PDF-1.7\nSample clean tax invoice stream content');
  const infectedPdfBuffer = Buffer.from(`%PDF-1.7\n${EICAR_TEST_STRING}\nMalware payload`);

  beforeEach(() => {
    IntakeService.clearInMemory();
    mockStorage.clear();
    mockScanner.setMode('heuristic');
    IntakeService.setStorage(mockStorage);
    IntakeService.setScanner(mockScanner);
    IntakeService.setStoreMode('memory');
  });

  describe('Clean Document Ingestion', () => {
    it('should successfully ingest clean PDF and transition status to QUEUED', async () => {
      const response = await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-01',
        userId: 'USR-88210',
        buffer: validPdfBuffer,
        originalFilename: 'tax_invoice_2026.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      expect(response.documentId).toMatch(/^DOC-/);
      expect(response.status).toBe('QUEUED');
      expect(response.stage).toBe('INGESTION_COMPLETE');
      expect(response.fileName).toBe('tax_invoice_2026.pdf');
      expect(response.mimeType).toBe('application/pdf');
      expect(response.fileSizeBytes).toBe(validPdfBuffer.length);
      expect(response.sha256Hash).toBeDefined();

      // Verify object exists in storage
      const fetched = await IntakeService.getDocument(response.documentId, 'TNT-CORP-01');
      expect(fetched).not.toBeNull();
      expect(fetched?.status).toBe('QUEUED');

      const storedObject = await mockStorage.getObject(fetched!.storagePath);
      expect(storedObject).not.toBeNull();
      expect(storedObject?.equals(validPdfBuffer)).toBe(true);
    });

    it('should sanitize filename during intake and prevent path traversal', async () => {
      const response = await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-01',
        userId: 'USR-88210',
        buffer: validPdfBuffer,
        originalFilename: '../../../../etc/shadow.pdf',
        declaredMimeType: 'application/pdf',
      });

      expect(response.fileName).toBe('shadow.pdf');
      expect(response.fileName).not.toContain('..');
    });
  });

  describe('Validation Rejections', () => {
    it('should throw IntakeValidationError when buffer is empty', async () => {
      await expect(
        IntakeService.ingestDocument({
          tenantId: 'TNT-CORP-01',
          userId: 'USR-88210',
          buffer: Buffer.alloc(0),
          originalFilename: 'empty.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(IntakeValidationError);
    });

    it('should throw IntakeValidationError when magic bytes do not match declared MIME', async () => {
      const fakePdf = Buffer.from('NOT_A_REAL_PDF_HEADER');
      await expect(
        IntakeService.ingestDocument({
          tenantId: 'TNT-CORP-01',
          userId: 'USR-88210',
          buffer: fakePdf,
          originalFilename: 'fake.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(IntakeValidationError);
    });
  });

  describe('Malware Detection & Quarantine Workflow', () => {
    it('should isolate infected file to quarantine path and throw MalwareDetectedError', async () => {
      await expect(
        IntakeService.ingestDocument({
          tenantId: 'TNT-CORP-01',
          userId: 'USR-88210',
          buffer: infectedPdfBuffer,
          originalFilename: 'infected_contract.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(MalwareDetectedError);

      // Verify clean storage has NO records
      const keys = mockStorage.listKeys('tenants/TNT-CORP-01/raw/');
      expect(keys.length).toBe(0);

      // Verify quarantine storage HAS the quarantined payload
      const quarantineKeys = mockStorage.listKeys('tenants/TNT-CORP-01/quarantine/');
      expect(quarantineKeys.length).toBe(1);
    });

    it('should fail closed when malware scanner is unavailable', async () => {
      mockScanner.setMode('fail_offline');

      await expect(
        IntakeService.ingestDocument({
          tenantId: 'TNT-CORP-01',
          userId: 'USR-88210',
          buffer: validPdfBuffer,
          originalFilename: 'invoice.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(ScannerUnavailableError);

      // Raw storage must NOT contain any ingested file
      const rawKeys = mockStorage.listKeys('tenants/TNT-CORP-01/raw/');
      expect(rawKeys.length).toBe(0);
    });
  });

  describe('Deduplication & Multi-Tenant Isolation', () => {
    it('should reject duplicate upload with matching hash within the same tenant', async () => {
      // 1. First upload succeeds
      await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-01',
        userId: 'USR-88210',
        buffer: validPdfBuffer,
        originalFilename: 'original.pdf',
        declaredMimeType: 'application/pdf',
      });

      // 2. Second upload with identical buffer in same tenant throws DuplicateDocumentError
      await expect(
        IntakeService.ingestDocument({
          tenantId: 'TNT-CORP-01',
          userId: 'USR-88210',
          buffer: validPdfBuffer,
          originalFilename: 'copy.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(DuplicateDocumentError);
    });

    it('should allow upload of identical document hash in a DIFFERENT tenant', async () => {
      // Tenant A
      const docA = await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-01',
        userId: 'USR-88210',
        buffer: validPdfBuffer,
        originalFilename: 'invoice_tenant_a.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Tenant B uploads same file - MUST SUCCEED due to tenant isolation
      const docB = await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-02',
        userId: 'USR-AUDIT-01',
        buffer: validPdfBuffer,
        originalFilename: 'invoice_tenant_b.pdf',
        declaredMimeType: 'application/pdf',
      });

      expect(docA.documentId).not.toBe(docB.documentId);
      expect(docA.sha256Hash).toBe(docB.sha256Hash);
    });

    it('should prevent cross-tenant access in getDocument()', async () => {
      const doc = await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-01',
        userId: 'USR-88210',
        buffer: validPdfBuffer,
        originalFilename: 'confidential.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Fetch by authorized tenant
      const authorizedFetch = await IntakeService.getDocument(doc.documentId, 'TNT-CORP-01');
      expect(authorizedFetch).not.toBeNull();
      expect(authorizedFetch?.documentId).toBe(doc.documentId);

      // Attempt cross-tenant fetch by Tenant B
      const unauthorizedFetch = await IntakeService.getDocument(doc.documentId, 'TNT-CORP-02');
      expect(unauthorizedFetch).toBeNull();
    });
  });
});
