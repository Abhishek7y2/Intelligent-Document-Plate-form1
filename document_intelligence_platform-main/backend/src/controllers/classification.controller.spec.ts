import { Response } from 'express';
import {
  classifyDocumentHandler,
  getClassificationHandler,
} from './classification.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ClassificationService } from '../services/classification.service.js';
import { IntakeService } from '../services/intake.service.js';
import { OcrService } from '../services/ocr.service.js';
import { SyntheticMockOcrAdapter } from '../services/mock-ocr.adapter.js';
import { DocumentRecord } from '../models/intake.models.js';

describe('Sprint 6: Classification Controller Endpoints & RFC 7807 Responses', () => {
  const tenantA = 'TNT-CORP-01';

  beforeEach(() => {
    IntakeService.clearInMemory();
    OcrService.clearInMemory();
    ClassificationService.clearInMemory();
    ClassificationService.setStoreMode('memory');
    OcrService.setEngine(new SyntheticMockOcrAdapter('standard'));
  });

  function createMockResponse() {
    let statusCode = 200;
    let jsonBody: any = null;

    const res: Partial<Response> = {
      status: jest.fn().mockImplementation((code: number) => {
        statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data: any) => {
        jsonBody = data;
        return res;
      }),
    };

    return {
      res: res as Response,
      getStatus: () => statusCode,
      getBody: () => jsonBody,
    };
  }

  async function setupReadyDocument(docId: string, tenantId: string): Promise<DocumentRecord> {
    const storagePath = `tenants/${tenantId}/clean/${docId}.pdf`;
    const dummyBuffer = Buffer.from('%PDF-1.4\n dummy test content \n%%EOF');
    await IntakeService.getStorage().putObject(storagePath, dummyBuffer);

    const doc: DocumentRecord = {
      documentId: docId,
      tenantId,
      fileName: 'invoice.pdf',
      storagePath,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      sha256Hash: 'a'.repeat(64),
      documentType: 'purchase-invoice',
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

  describe('POST /api/v1/documents/:id/classify', () => {
    it('should return 401 when authentication token is missing tenant context', async () => {
      const req = {
        params: { id: 'DOC-123' },
        user: undefined,
        originalUrl: '/api/v1/documents/DOC-123/classify',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await classifyDocumentHandler(req, res, jest.fn());

      expect(getStatus()).toBe(401);
      expect(getBody().type).toContain('UNAUTHORIZED');
    });

    it('should return 403 RFC 7807 when document is quarantined', async () => {
      const doc = await setupReadyDocument('DOC-QUARANTINE', tenantA);
      doc.status = 'QUARANTINED';
      IntakeService.setInMemoryDocument(doc);

      const req = {
        params: { id: 'DOC-QUARANTINE' },
        user: { userId: 'u1', email: 'test@docunexa.com', role: 'Admin', tenantId: tenantA },
        originalUrl: '/api/v1/documents/DOC-QUARANTINE/classify',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await classifyDocumentHandler(req, res, jest.fn());

      expect(getStatus()).toBe(403);
      expect(getBody().type).toContain('DOCUMENT_QUARANTINED');
    });

    it('should return 404 RFC 7807 when document does not exist', async () => {
      const req = {
        params: { id: 'DOC-MISSING' },
        user: { userId: 'u1', email: 'test@docunexa.com', role: 'Admin', tenantId: tenantA },
        originalUrl: '/api/v1/documents/DOC-MISSING/classify',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await classifyDocumentHandler(req, res, jest.fn());

      expect(getStatus()).toBe(404);
      expect(getBody().type).toContain('DOCUMENT_NOT_FOUND');
    });

    it('should return 400 when document has not undergone OCR processing', async () => {
      await setupReadyDocument('DOC-NO-OCR', tenantA);

      const req = {
        params: { id: 'DOC-NO-OCR' },
        user: { userId: 'u1', email: 'test@docunexa.com', role: 'Admin', tenantId: tenantA },
        originalUrl: '/api/v1/documents/DOC-NO-OCR/classify',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await classifyDocumentHandler(req, res, jest.fn());

      expect(getStatus()).toBe(400);
      expect(getBody().type).toContain('OCR_REQUIRED_FOR_CLASSIFICATION');
    });

    it('should classify document and return 200 with result', async () => {
      await setupReadyDocument('DOC-SUCCESS', tenantA);
      await OcrService.processDocument('DOC-SUCCESS', tenantA);

      const req = {
        params: { id: 'DOC-SUCCESS' },
        user: { userId: 'u1', email: 'test@docunexa.com', role: 'Admin', tenantId: tenantA },
        originalUrl: '/api/v1/documents/DOC-SUCCESS/classify',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await classifyDocumentHandler(req, res, jest.fn());

      expect(getStatus()).toBe(200);
      expect(getBody().status).toBe('SUCCESS');
      expect(getBody().data.predictedType).toBe('purchase-invoice');
      expect(getBody().data.confidenceScore).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('GET /api/v1/documents/:id/classification', () => {
    it('should return 404 when classification has not been performed', async () => {
      const req = {
        params: { id: 'DOC-UNCLASSIFIED' },
        user: { userId: 'u1', email: 'test@docunexa.com', role: 'Admin', tenantId: tenantA },
        originalUrl: '/api/v1/documents/DOC-UNCLASSIFIED/classification',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await getClassificationHandler(req, res, jest.fn());

      expect(getStatus()).toBe(404);
      expect(getBody().type).toContain('CLASSIFICATION_NOT_FOUND');
    });

    it('should return 200 and classification result when exists', async () => {
      await setupReadyDocument('DOC-EXISTS', tenantA);
      await OcrService.processDocument('DOC-EXISTS', tenantA);
      await ClassificationService.classifyDocument('DOC-EXISTS', tenantA);

      const req = {
        params: { id: 'DOC-EXISTS' },
        user: { userId: 'u1', email: 'test@docunexa.com', role: 'Admin', tenantId: tenantA },
        originalUrl: '/api/v1/documents/DOC-EXISTS/classification',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await getClassificationHandler(req, res, jest.fn());

      expect(getStatus()).toBe(200);
      expect(getBody().status).toBe('SUCCESS');
      expect(getBody().data.documentId).toBe('DOC-EXISTS');
    });
  });
});
