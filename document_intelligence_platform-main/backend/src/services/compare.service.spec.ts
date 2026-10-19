import {
  CompareService,
  CompareNotFoundError,
  IncomparableDocumentError,
} from './compare.service.js';
import { IntakeService } from './intake.service.js';

describe('CompareService (FR-012 Document Version Comparison Studio)', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(() => {
    CompareService.setStoreMode('memory');
    CompareService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();

    // Baseline document v1.0
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10245-v1',
      tenantId: tenantA,
      fileName: 'Master_Services_Agreement_v1.0.pdf',
      storagePath: '/tenants/TNT-CORP-01/v1.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      sha256Hash: 'e1e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 12,
      uploadedAt: new Date('2026-01-15T10:00:00Z'),
    });

    // Amendment document v2.0
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10245-v2',
      tenantId: tenantA,
      fileName: 'Master_Services_Agreement_v2.0_Amended.pdf',
      storagePath: '/tenants/TNT-CORP-01/v2.pdf',
      fileSizeBytes: 2148576,
      mimeType: 'application/pdf',
      sha256Hash: 'e2e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef1',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.96,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 14,
      uploadedAt: new Date('2026-10-06T10:00:00Z'),
    });

    // Cross-tenant document in tenant B
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-TENANT-B',
      tenantId: tenantB,
      fileName: 'Tenant_B_Contract.pdf',
      storagePath: '/tenants/TNT-CORP-02/b.pdf',
      fileSizeBytes: 1048576,
      mimeType: 'application/pdf',
      sha256Hash: 'e3e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef2',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.94,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 5,
      uploadedAt: new Date('2026-05-01T10:00:00Z'),
    });
  });

  describe('Word Diffing Engine', () => {
    it('should identify unchanged text as normal chunks', () => {
      const text = 'Payment terms: Net 30 days from invoice receipt.';
      const diff = CompareService.computeWordDiff(text, text);

      expect(diff.unifiedChunks.length).toBe(1);
      expect(diff.unifiedChunks[0]?.type).toBe('normal');
      expect(diff.unifiedChunks[0]?.text).toBe(text);
    });

    it('should identify inserted text as added chunks', () => {
      const v1 = '';
      const v2 = 'Vendor shall adhere to EU GDPR Data Protection standards.';
      const diff = CompareService.computeWordDiff(v1, v2);

      const addedChunk = diff.v2Chunks.find((c) => c.type === 'added');
      expect(addedChunk).toBeDefined();
      expect(addedChunk?.text).toBe(v2);
    });

    it('should identify removed text as removed chunks', () => {
      const v1 = 'Either party may terminate for convenience with 15 days notice.';
      const v2 = '';
      const diff = CompareService.computeWordDiff(v1, v2);

      const removedChunk = diff.v1Chunks.find((c) => c.type === 'removed');
      expect(removedChunk).toBeDefined();
      expect(removedChunk?.text).toBe(v1);
    });

    it('should compute unified chunks showing inline insertions and deletions', () => {
      const v1 = 'Payment terms: Net 45 days.';
      const v2 = 'Payment terms: Net 30 days.';
      const diff = CompareService.computeWordDiff(v1, v2);

      expect(diff.unifiedChunks.some((c) => c.type === 'removed')).toBe(true);
      expect(diff.unifiedChunks.some((c) => c.type === 'added')).toBe(true);
    });
  });

  describe('Risk Classification', () => {
    it('should classify uncapped liability as High risk', () => {
      const risk = CompareService.classifyRisk(
        'Liability Cap',
        'Liability is capped strictly at 100% of contract value.',
        'Liability shall be uncapped for gross negligence or willful misconduct.'
      );

      expect(risk.riskImpact).toBe('High');
      expect(risk.category).toBe('commercial');
      expect(risk.plainEnglishImpact).toContain('unlimited');
      expect(risk.legalRecommendation).toContain('HIGH RISK');
    });

    it('should classify auto-renewal evergreen terms as Medium risk', () => {
      const risk = CompareService.classifyRisk(
        'Renewal Clause',
        '',
        'Agreement shall automatically renew for 12 months unless notice is served 60 days prior.'
      );

      expect(risk.riskImpact).toBe('Medium');
      expect(risk.category).toBe('compliance');
    });

    it('should classify expedited security incident windows as Medium risk', () => {
      const risk = CompareService.classifyRisk(
        'Data Security',
        'Notify customer within 72 hours.',
        'Notify customer within 24 hours of suspected discovery and submit forensic analysis.'
      );

      expect(risk.riskImpact).toBe('Medium');
      expect(risk.category).toBe('compliance');
    });
  });

  describe('Document Version Comparison Studio', () => {
    it('should compare two document versions within tenant and return comprehensive diff model', async () => {
      const result = await CompareService.compareDocuments(
        'DOC-10245-v1',
        'DOC-10245-v2',
        tenantA,
        'USER-REV-01'
      );

      expect(result.comparisonId).toBeDefined();
      expect(result.tenantId).toBe(tenantA);
      expect(result.summary.totalClauses).toBe(4);
      expect(result.summary.highRiskCount).toBeGreaterThanOrEqual(1);
      expect(result.clauses.length).toBe(4);
      expect(result.fieldDiffs.length).toBe(4);

      // Verify page citations exist on clauses
      for (const clause of result.clauses) {
        expect(clause.pageCitationV1).toBeDefined();
        expect(clause.pageCitationV2).toBeDefined();
      }

      // Verify retrieval by ID
      const cached = CompareService.getComparison(result.comparisonId);
      expect(cached).toEqual(result);
    });

    it('should strictly reject comparison if a document does not belong to the tenant', async () => {
      await expect(
        CompareService.compareDocuments('DOC-10245-v1', 'DOC-TENANT-B', tenantA)
      ).rejects.toThrow(CompareNotFoundError);
    });

    it('should throw CompareNotFoundError if a document ID is non-existent', async () => {
      await expect(
        CompareService.compareDocuments('DOC-10245-v1', 'DOC-NON-EXISTENT', tenantA)
      ).rejects.toThrow(CompareNotFoundError);
    });

    it('should reject comparison of incompatible document types with IncomparableDocumentError', async () => {
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-INVOICE-01',
        tenantId: tenantA,
        fileName: 'Invoice.pdf',
        storagePath: '/tenants/TNT-CORP-01/inv.pdf',
        fileSizeBytes: 12345,
        mimeType: 'application/pdf',
        sha256Hash: 'ff1e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        documentType: 'Purchase Invoice',
        status: 'APPROVED',
        stage: 'PUBLISHED',
        confidenceScore: 0.98,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      await expect(
        CompareService.compareDocuments('DOC-10245-v1', 'DOC-INVOICE-01', tenantA)
      ).rejects.toThrow(IncomparableDocumentError);
    });
  });
});
