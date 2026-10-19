import { QaService, QaValidationError, CitationAccessDeniedError } from './qa.service.js';
import { IntakeService } from './intake.service.js';
import { SearchService } from './search.service.js';
import { ModelProviderService, SyntheticModelProvider } from './model-provider.service.js';

describe('Grounded Q&A Service (FR-013, AI-006 Grounding & Citations)', () => {
  const TENANT_A = 'TNT-CORP-01';
  const USER_A = 'USR-ANALYST-01';

  beforeEach(() => {
    QaService.setStoreMode('memory');
    QaService.clearInMemory();
    SearchService.setStoreMode('memory');
    SearchService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();
    ModelProviderService.setProvider(new SyntheticModelProvider());

    // Seed mock active document for Tenant A
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10248',
      tenantId: TENANT_A,
      fileName: 'Acme_Supplier_Agreement.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10248.pdf',
      fileSizeBytes: 204800,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-doc-10248',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 3,
      uploadedAt: new Date(),
    });

    // Seed indexed chunks for DOC-10248
    SearchService.setInMemoryChunks(TENANT_A, 'DOC-10248', [
      {
        chunkId: 'CHK-10248-p1',
        documentId: 'DOC-10248',
        tenantId: TENANT_A,
        chunkIndex: 0,
        sourceVersion: 'v2.0',
        pageNumber: 1,
        chunkText: 'Payment terms shall be Net 30 days from receipt of a verified invoice.',
        embedding: new Array(1536).fill(0.01),
        createdAt: new Date(),
      },
      {
        chunkId: 'CHK-10248-p2',
        documentId: 'DOC-10248',
        tenantId: TENANT_A,
        chunkIndex: 1,
        sourceVersion: 'v2.0',
        pageNumber: 2,
        chunkText: 'Either party may terminate this agreement with thirty (30) days prior written notice.',
        embedding: new Array(1536).fill(0.01),
        createdAt: new Date(),
      },
    ]);
  });

  describe('Input Validation & Constraints', () => {
    it('rejects questions shorter than 3 characters', async () => {
      await expect(
        QaService.askQuestion(TENANT_A, USER_A, { question: 'hi' })
      ).rejects.toThrow(QaValidationError);
    });

    it('rejects questions longer than 1000 characters', async () => {
      const longQuestion = 'a'.repeat(1001);
      await expect(
        QaService.askQuestion(TENANT_A, USER_A, { question: longQuestion })
      ).rejects.toThrow(QaValidationError);
    });

    it('rejects empty or whitespace-only questions', async () => {
      await expect(
        QaService.askQuestion(TENANT_A, USER_A, { question: '   ' })
      ).rejects.toThrow(QaValidationError);
    });
  });

  describe('Grounded Answering & Citation Mapping', () => {
    it('answers factual question and returns verifiable citation with page number and source version', async () => {
      const resp = await QaService.askQuestion(TENANT_A, USER_A, {
        question: 'What are the payment terms?',
        documentId: 'DOC-10248',
      });

      expect(resp.status).toBe('ANSWERED');
      expect(resp.answer).toContain('Net 30');
      expect(resp.confidence).toBeGreaterThan(0.8);
      expect(resp.citations.length).toBeGreaterThan(0);

      const citation = resp.citations[0]!;
      expect(citation.documentId).toBe('DOC-10248');
      expect(citation.pageNumber).toBe(1);
      expect(citation.sourceVersion).toBe('v2.0');
      expect(citation.snippet).toContain('Net 30');
      expect(citation.isAuthorized).toBe(true);
    });

    it('abstains with INSUFFICIENT_EVIDENCE when question cannot be answered from document', async () => {
      const resp = await QaService.askQuestion(TENANT_A, USER_A, {
        question: 'What is the CEO personal home address and private phone number?',
        documentId: 'DOC-10248',
      });

      expect(resp.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(resp.abstentionReason).toBe('INSUFFICIENT_FACTUAL_EVIDENCE');
      expect(resp.answer).toContain('cannot answer');
      expect(resp.citations).toHaveLength(0);
    });

    it('abstains if requested document is quarantined or not found in tenant', async () => {
      const resp = await QaService.askQuestion(TENANT_A, USER_A, {
        question: 'What is in this quarantined file?',
        documentId: 'DOC-NON-EXISTENT',
      });

      expect(resp.status).toBe('ABSTAINED');
      expect(resp.abstentionReason).toBe('DOCUMENT_NOT_ACCESSIBLE');
      expect(resp.citations).toHaveLength(0);
    });
  });

  describe('Document Freshness & Superseded Version Detection', () => {
    it('attaches freshness notice when answer is derived from superseded version', async () => {
      // Simulate document record having a newer active version v3.0
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-10248',
        tenantId: TENANT_A,
        fileName: 'Acme_Supplier_Agreement.pdf',
        storagePath: '/tenants/TNT-CORP-01/DOC-10248.pdf',
        fileSizeBytes: 204800,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-doc-10248',
        documentType: 'Supplier Contract',
        status: 'APPROVED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: 0.95,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 3,
        uploadedAt: new Date(),
        latestVersion: 'v3.0', // Newer version exists
      } as any);

      const resp = await QaService.askQuestion(TENANT_A, USER_A, {
        question: 'What is the notice period for termination?',
        documentId: 'DOC-10248',
      });

      expect(resp.status).toBe('ANSWERED');
      expect(resp.documentFreshness).toBeDefined();
      expect(resp.documentFreshness?.length).toBeGreaterThan(0);
      expect(resp.documentFreshness?.[0]?.isSuperseded).toBe(true);
      expect(resp.documentFreshness?.[0]?.latestVersion).toBe('v3.0');
      expect(resp.documentFreshness?.[0]?.usedVersion).toBe('v2.0');
    });
  });

  describe('Click-Time Citation Authorization Re-check', () => {
    it('authorizes citation access when document exists and user possesses DOC_VIEW', async () => {
      const result = await QaService.verifyCitationAccess(
        TENANT_A,
        'Analyst',
        'DOC-10248',
        'CITE-TEST-01'
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.documentId).toBe('DOC-10248');
      expect(result.redirectUrl).toContain('/documents/DOC-10248');
    });

    it('rejects citation access with CitationAccessDeniedError when user lacks DOC_VIEW', async () => {
      // Create custom role lacking DOC_VIEW (or invalid role)
      await expect(
        QaService.verifyCitationAccess(TENANT_A, 'UnknownRole', 'DOC-10248', 'CITE-TEST-01')
      ).rejects.toThrow(CitationAccessDeniedError);
    });

    it('rejects citation access if document was deleted or quarantined after answer was generated', async () => {
      // Mark document as QUARANTINED
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-10248',
        tenantId: TENANT_A,
        fileName: 'Acme_Supplier_Agreement.pdf',
        storagePath: '/tenants/TNT-CORP-01/DOC-10248.pdf',
        fileSizeBytes: 204800,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-doc-10248',
        documentType: 'Supplier Contract',
        status: 'QUARANTINED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 3,
        uploadedAt: new Date(),
      });

      await expect(
        QaService.verifyCitationAccess(TENANT_A, 'Analyst', 'DOC-10248', 'CITE-TEST-01')
      ).rejects.toThrow(CitationAccessDeniedError);
    });
  });

  describe('User Feedback Submission', () => {
    it('records helpful feedback for an existing trace', async () => {
      const qResp = await QaService.askQuestion(TENANT_A, USER_A, {
        question: 'When must invoices be paid?',
      });

      const success = await QaService.submitFeedback(TENANT_A, qResp.traceId, 'HELPFUL');
      expect(success).toBe(true);
    });
  });
});
