import { SearchService, SearchValidationError } from './search.service.js';
import { IntakeService } from './intake.service.js';
import { OcrService } from './ocr.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';

describe('SearchService (FR-014 Semantic & Hybrid Search)', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(() => {
    SearchService.setStoreMode('memory');
    SearchService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();
    OcrService.setStoreMode('memory');
    OcrService.clearInMemory();
    OcrService.setEngine(new SyntheticMockOcrAdapter());

    // Seed document in tenant A
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10248',
      tenantId: tenantA,
      fileName: 'Acme_Supplier_Agreement.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10248.pdf',
      fileSizeBytes: 1048576,
      mimeType: 'application/pdf',
      sha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.96,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 4,
      uploadedAt: new Date('2026-10-01T10:00:00Z'),
    });

    // Seed another document in tenant A
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10247',
      tenantId: tenantA,
      fileName: 'Apex_Purchase_Invoice_INV78421.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10247.pdf',
      fileSizeBytes: 524288,
      mimeType: 'application/pdf',
      sha256Hash: 'b1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef1',
      documentType: 'Purchase Invoice',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.98,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 2,
      uploadedAt: new Date('2026-10-02T10:00:00Z'),
    });

    // Seed quarantined document in tenant A
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-QUARANTINED',
      tenantId: tenantA,
      fileName: 'infected_payload.pdf',
      storagePath: '/quarantine/DOC-QUARANTINED.pdf',
      fileSizeBytes: 12345,
      mimeType: 'application/pdf',
      sha256Hash: 'c1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef2',
      documentType: 'Supplier Contract',
      status: 'QUARANTINED',
      stage: 'SECURITY_QUARANTINE',
      confidenceScore: null,
      slaStatus: 'WARNING',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date('2026-10-03T10:00:00Z'),
    });

    // Seed document in tenant B (cross-tenant fence test)
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-TENANT-B',
      tenantId: tenantB,
      fileName: 'Confidential_Tenant_B_Contract.pdf',
      storagePath: '/tenants/TNT-CORP-02/DOC-TENANT-B.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      sha256Hash: 'd1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef3',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 5,
      uploadedAt: new Date('2026-10-04T10:00:00Z'),
    });
  });

  describe('Text Chunking Engine', () => {
    it('should split text into chunks respecting character limits', () => {
      const longText = `Section 1: General Terms. This is a comprehensive introduction paragraph covering the baseline agreement.
      
Section 2: Payment and Invoicing. Vendor shall deliver monthly invoices with 30-day payment schedules. All payments shall be made in USD currency via wire transfer.
      
Section 3: Termination. Either party may terminate with 30 days prior written notice.`;

      const chunks = SearchService.splitTextIntoChunks(longText, 150, 20);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(200);
      }
    });

    it('should return empty array for empty or whitespace text', () => {
      expect(SearchService.splitTextIntoChunks('')).toEqual([]);
      expect(SearchService.splitTextIntoChunks('   \n\n  ')).toEqual([]);
    });
  });

  describe('Document Indexing Pipeline', () => {
    it('should successfully index an eligible document into 1536-dim vector chunks', async () => {
      const indexResult = await SearchService.indexDocument('DOC-10248', tenantA);

      expect(indexResult.status).toBe('INDEXED');
      expect(indexResult.documentId).toBe('DOC-10248');
      expect(indexResult.tenantId).toBe(tenantA);
      expect(indexResult.chunksIndexed).toBeGreaterThan(0);
    });

    it('should guarantee idempotency on re-indexing without creating duplicate chunks', async () => {
      const firstIndex = await SearchService.indexDocument('DOC-10248', tenantA);
      const secondIndex = await SearchService.indexDocument('DOC-10248', tenantA, { force: true });

      expect(firstIndex.chunksIndexed).toBe(secondIndex.chunksIndexed);

      // Verify search results still deduplicate cleanly
      const searchRes = await SearchService.search(tenantA, { query: 'supplier agreement' });
      const docMatches = searchRes.results.filter((r) => r.docId === 'DOC-10248');
      expect(docMatches.length).toBe(1);
    });

    it('should skip indexing for quarantined or failed documents', async () => {
      const skipResult = await SearchService.indexDocument('DOC-QUARANTINED', tenantA);

      expect(skipResult.status).toBe('SKIPPED');
      expect(skipResult.chunksIndexed).toBe(0);
      expect(skipResult.reason).toContain('QUARANTINED');
    });

    it('should reject indexing if document does not belong to specified tenant', async () => {
      await expect(
        SearchService.indexDocument('DOC-TENANT-B', tenantA)
      ).rejects.toThrow('not found in tenant TNT-CORP-01');
    });
  });

  describe('Search & Semantic Retrieval', () => {
    beforeEach(async () => {
      await SearchService.indexDocument('DOC-10248', tenantA);
      await SearchService.indexDocument('DOC-10247', tenantA);
      await SearchService.indexDocument('DOC-TENANT-B', tenantB);
    });

    it('should retrieve relevant documents with normalized match scores and snippets', async () => {
      const response = await SearchService.search(tenantA, {
        query: 'Acme supplier agreement contract',
      });

      expect(response.totalMatches).toBeGreaterThan(0);
      expect(response.results[0]?.docId).toBe('DOC-10248');
      expect(response.results[0]?.matchScore).toBeGreaterThan(0);
      expect(response.results[0]?.snippet).toBeDefined();
    });

    it('should strictly enforce tenant boundary (zero cross-tenant results)', async () => {
      const responseTenantA = await SearchService.search(tenantA, {
        query: 'Confidential Tenant B Contract',
      });

      const leakedDocs = responseTenantA.results.filter((r) => r.docId === 'DOC-TENANT-B');
      expect(leakedDocs.length).toBe(0);
    });

    it('should filter results by document type facet', async () => {
      const response = await SearchService.search(tenantA, {
        query: 'agreement or invoice',
        filters: { documentType: 'Purchase Invoice' },
      });

      for (const res of response.results) {
        expect(res.category).toBe('Purchase Invoice');
      }
    });

    it('should support pagination limit and offset', async () => {
      const response = await SearchService.search(tenantA, {
        query: 'document',
        limit: 1,
        offset: 0,
      });

      expect(response.results.length).toBeLessThanOrEqual(1);
    });

    it('should throw SearchValidationError when query is empty', async () => {
      await expect(SearchService.search(tenantA, { query: '' })).rejects.toThrow(
        SearchValidationError
      );
      await expect(SearchService.search(tenantA, { query: '   ' })).rejects.toThrow(
        SearchValidationError
      );
    });

    it('should safely handle regex special characters in search queries without throwing', async () => {
      const response = await SearchService.search(tenantA, {
        query: 'Net (30) [days] 18% *agreement+?',
      });

      expect(response).toBeDefined();
      expect(response.totalMatches).toBeGreaterThanOrEqual(0);
    });

    it('should delete document index cleanly via deleteDocumentIndex', async () => {
      await SearchService.deleteDocumentIndex('DOC-10248', tenantA);
      const searchRes = await SearchService.search(tenantA, { query: 'Acme supplier' });
      const found = searchRes.results.some((r) => r.docId === 'DOC-10248');
      expect(found).toBe(false);
    });
  });
});
