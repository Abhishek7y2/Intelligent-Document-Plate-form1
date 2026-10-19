import { Response } from 'express';
import {
  askQuestionHandler,
  verifyCitationHandler,
  listQaDocumentsHandler,
  submitFeedbackHandler,
} from './qa.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { QaService } from '../services/qa.service.js';
import { IntakeService } from '../services/intake.service.js';
import { SearchService } from '../services/search.service.js';
import { ModelProviderService, SyntheticModelProvider } from '../services/model-provider.service.js';

describe('QaController (FR-013, FR-015 Grounded Q&A REST API Contract)', () => {
  const tenantId = 'TNT-CORP-01';
  const userId = 'USR-ANALYST-01';

  beforeEach(() => {
    QaService.setStoreMode('memory');
    QaService.clearInMemory();
    SearchService.setStoreMode('memory');
    SearchService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();
    ModelProviderService.setProvider(new SyntheticModelProvider());

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10248',
      tenantId,
      fileName: 'Acme_Supplier_Agreement.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10248.pdf',
      fileSizeBytes: 204800,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-10248',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 3,
      uploadedAt: new Date(),
    });

    SearchService.setInMemoryChunks(tenantId, 'DOC-10248', [
      {
        chunkId: 'CHK-10248-p1',
        documentId: 'DOC-10248',
        tenantId,
        chunkIndex: 0,
        sourceVersion: 'v2.0',
        pageNumber: 1,
        chunkText: 'Payment terms shall be Net 30 days from invoice receipt.',
        embedding: new Array(1536).fill(0.01),
        createdAt: new Date(),
      },
    ]);
  });

  describe('POST /api/v1/qa/query', () => {
    it('returns 200 with structured answer and citations for valid question', async () => {
      const mockReq = {
        method: 'POST',
        headers: {},
        body: {
          question: 'What are the payment terms?',
          documentId: 'DOC-10248',
        },
        user: {
          userId,
          email: 'analyst@docunexa.io',
          role: 'Reviewer',
          tenantId,
          permissions: ['DOC_VIEW', 'QA_QUERY'],
        },
      } as unknown as AuthenticatedRequest;

      let responseJson: any = null;
      let responseStatus = 0;

      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseJson = data;
            },
          };
        },
      } as unknown as Response;

      await askQuestionHandler(mockReq, mockRes);

      expect(responseStatus).toBe(200);
      expect(responseJson.traceId).toBeDefined();
      expect(responseJson.status).toBe('ANSWERED');
      expect(responseJson.answer).toContain('Net 30');
      expect(responseJson.citations.length).toBeGreaterThan(0);
    });

    it('returns 400 when question is missing or too short', async () => {
      const mockReq = {
        method: 'POST',
        headers: {},
        body: { question: 'no' },
        user: {
          userId,
          email: 'analyst@docunexa.io',
          role: 'Reviewer',
          tenantId,
          permissions: ['DOC_VIEW', 'QA_QUERY'],
        },
      } as unknown as AuthenticatedRequest;

      let responseStatus = 0;
      let responseJson: any = null;

      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseJson = data;
            },
          };
        },
      } as unknown as Response;

      await askQuestionHandler(mockReq, mockRes);

      expect(responseStatus).toBe(400);
      expect(responseJson.error.code).toBe('QA_VALIDATION_ERROR');
    });

    it('returns 401 when tenant identity is missing', async () => {
      const mockReq = {
        method: 'POST',
        headers: {},
        body: { question: 'What is the price?' },
        user: undefined,
      } as unknown as AuthenticatedRequest;

      let responseStatus = 0;
      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return { json: jest.fn() };
        },
      } as unknown as Response;

      await askQuestionHandler(mockReq, mockRes);

      expect(responseStatus).toBe(401);
    });
  });

  describe('POST /api/v1/qa/citations/verify', () => {
    it('returns 200 with verified authorization details for authorized citation click', async () => {
      const mockReq = {
        method: 'POST',
        body: {
          documentId: 'DOC-10248',
          citationId: 'CITE-01',
        },
        user: {
          userId,
          email: 'analyst@docunexa.io',
          role: 'Reviewer',
          tenantId,
          permissions: ['DOC_VIEW'],
        },
      } as unknown as AuthenticatedRequest;

      let responseJson: any = null;
      let responseStatus = 0;

      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseJson = data;
            },
          };
        },
      } as unknown as Response;

      await verifyCitationHandler(mockReq, mockRes);

      expect(responseStatus).toBe(200);
      expect(responseJson.isAuthorized).toBe(true);
      expect(responseJson.documentId).toBe('DOC-10248');
      expect(responseJson.redirectUrl).toBeDefined();
    });

    it('returns 403 when citation points to cross-tenant or missing document', async () => {
      const mockReq = {
        method: 'POST',
        body: {
          documentId: 'DOC-FOREIGN-99',
          citationId: 'CITE-FOREIGN',
        },
        user: {
          userId,
          email: 'analyst@docunexa.io',
          role: 'Reviewer',
          tenantId,
          permissions: ['DOC_VIEW'],
        },
      } as unknown as AuthenticatedRequest;

      let responseStatus = 0;
      let responseJson: any = null;

      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseJson = data;
            },
          };
        },
      } as unknown as Response;

      await verifyCitationHandler(mockReq, mockRes);

      expect(responseStatus).toBe(403);
      expect(responseJson.error.code).toBe('CITATION_ACCESS_DENIED');
    });
  });

  describe('GET /api/v1/qa/documents', () => {
    it('returns 200 with list of eligible documents for tenant context dropdown', async () => {
      const mockReq = {
        method: 'GET',
        user: {
          userId,
          email: 'analyst@docunexa.io',
          role: 'Reviewer',
          tenantId,
          permissions: ['DOC_VIEW'],
        },
      } as unknown as AuthenticatedRequest;

      let responseJson: any = null;
      let responseStatus = 0;

      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseJson = data;
            },
          };
        },
      } as unknown as Response;

      await listQaDocumentsHandler(mockReq, mockRes);

      expect(responseStatus).toBe(200);
      expect(responseJson.documents).toHaveLength(1);
      expect(responseJson.documents[0].id).toBe('DOC-10248');
    });
  });

  describe('POST /api/v1/qa/traces/:traceId/feedback', () => {
    it('records feedback successfully and returns 200', async () => {
      // First ask question to create trace
      const askResult = await QaService.askQuestion(tenantId, userId, {
        question: 'What are the payment terms?',
      });

      const mockReq = {
        method: 'POST',
        params: { traceId: askResult.traceId },
        body: { feedback: 'HELPFUL' },
        user: {
          userId,
          email: 'analyst@docunexa.io',
          role: 'Reviewer',
          tenantId,
          permissions: ['DOC_VIEW'],
        },
      } as unknown as AuthenticatedRequest;

      let responseJson: any = null;
      let responseStatus = 0;

      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseJson = data;
            },
          };
        },
      } as unknown as Response;

      await submitFeedbackHandler(mockReq, mockRes);

      expect(responseStatus).toBe(200);
      expect(responseJson.success).toBe(true);
    });
  });
});
