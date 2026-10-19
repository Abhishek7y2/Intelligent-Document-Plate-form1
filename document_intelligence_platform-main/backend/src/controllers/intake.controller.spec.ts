import { Response } from 'express';
import { uploadDocumentHandler, getDocumentDetailHandler } from './intake.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { IntakeService } from '../services/intake.service.js';
import { MockMalwareScanner } from '../services/scanner.service.js';
import { MemoryStorageService } from '../services/storage.service.js';

describe('Sprint 4: Intake Controller Endpoints & RFC 7807 Responses', () => {
  const validPdfBuffer = Buffer.from('%PDF-1.7\nSample Invoice Content');
  const mockStorage = new MemoryStorageService();
  const mockScanner = new MockMalwareScanner('heuristic');

  beforeEach(() => {
    IntakeService.clearInMemory();
    mockStorage.clear();
    mockScanner.setMode('heuristic');
    IntakeService.setStorage(mockStorage);
    IntakeService.setScanner(mockScanner);
    IntakeService.setStoreMode('memory');
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

  describe('POST /api/v1/documents/upload Handler', () => {
    it('should return 400 MISSING_FILE when no file is attached in multipart payload', async () => {
      const req = {
        originalUrl: '/api/v1/documents/upload',
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_UPLOAD'] },
        body: {},
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await uploadDocumentHandler(req, res, next);

      expect(getStatus()).toBe(400);
      expect(getBody().type).toContain('MISSING_FILE');
    });

    it('should return 401 UNAUTHORIZED when tenant context is missing from request', async () => {
      const req = {
        originalUrl: '/api/v1/documents/upload',
        file: {
          buffer: validPdfBuffer,
          originalname: 'invoice.pdf',
          mimetype: 'application/pdf',
        },
        user: undefined,
        body: {},
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await uploadDocumentHandler(req, res, next);

      expect(getStatus()).toBe(401);
      expect(getBody().type).toContain('UNAUTHORIZED');
    });

    it('should return 202 ACCEPTED on valid document upload', async () => {
      const req = {
        originalUrl: '/api/v1/documents/upload',
        file: {
          buffer: validPdfBuffer,
          originalname: 'vendor_invoice.pdf',
          mimetype: 'application/pdf',
        },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_UPLOAD'] },
        body: { documentType: 'purchase-invoice' },
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await uploadDocumentHandler(req, res, next);

      expect(getStatus()).toBe(202);
      expect(getBody().status).toBe('SUCCESS');
      expect(getBody().data.documentId).toBeDefined();
      expect(getBody().data.status).toBe('QUEUED');
      expect(getBody().data.fileName).toBe('vendor_invoice.pdf');
    });

    it('should return 422 RFC 7807 when file magic bytes mismatch declared MIME', async () => {
      const corruptBuffer = Buffer.from('NOT_A_PDF');
      const req = {
        originalUrl: '/api/v1/documents/upload',
        file: {
          buffer: corruptBuffer,
          originalname: 'bad.pdf',
          mimetype: 'application/pdf',
        },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_UPLOAD'] },
        body: {},
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await uploadDocumentHandler(req, res, next);

      expect(getStatus()).toBe(422);
      expect(getBody().type).toContain('FILE_VALIDATION_FAILED');
      expect(getBody().status).toBe(422);
    });

    it('should return 422 RFC 7807 with quarantined=true when malware is detected', async () => {
      mockScanner.setMode('always_infected');
      const req = {
        originalUrl: '/api/v1/documents/upload',
        file: {
          buffer: validPdfBuffer,
          originalname: 'suspicious.pdf',
          mimetype: 'application/pdf',
        },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_UPLOAD'] },
        body: {},
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await uploadDocumentHandler(req, res, next);

      expect(getStatus()).toBe(422);
      expect(getBody().type).toContain('MALWARE_DETECTED');
      expect(getBody().quarantined).toBe(true);
      expect(getBody().threat).toBeDefined();
    });

    it('should return 409 RFC 7807 when duplicate file is uploaded in same tenant', async () => {
      const req = {
        originalUrl: '/api/v1/documents/upload',
        file: {
          buffer: validPdfBuffer,
          originalname: 'original.pdf',
          mimetype: 'application/pdf',
        },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_UPLOAD'] },
        body: {},
      } as unknown as AuthenticatedRequest;

      const { res: res1 } = createMockResponse();
      await uploadDocumentHandler(req, res1, jest.fn());

      // Second attempt with same file
      const { res: res2, getStatus: getStatus2, getBody: getBody2 } = createMockResponse();
      await uploadDocumentHandler(req, res2, jest.fn());

      expect(getStatus2()).toBe(409);
      expect(getBody2().type).toContain('DUPLICATE_DOCUMENT');
      expect(getBody2().existingDocumentId).toBeDefined();
    });

    it('should return 503 RFC 7807 when malware scanner is offline (fail-closed)', async () => {
      mockScanner.setMode('fail_offline');
      const req = {
        originalUrl: '/api/v1/documents/upload',
        file: {
          buffer: validPdfBuffer,
          originalname: 'invoice.pdf',
          mimetype: 'application/pdf',
        },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_UPLOAD'] },
        body: {},
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await uploadDocumentHandler(req, res, next);

      expect(getStatus()).toBe(503);
      expect(getBody().type).toContain('SCANNER_UNAVAILABLE');
    });
  });

  describe('GET /api/v1/documents/:id Detail Handler', () => {
    it('should return 404 when document does not exist or belongs to another tenant', async () => {
      const req = {
        originalUrl: '/api/v1/documents/DOC-NONEXISTENT',
        params: { id: 'DOC-NONEXISTENT' },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_VIEW'] },
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await getDocumentDetailHandler(req, res, next);

      expect(getStatus()).toBe(404);
      expect(getBody().type).toContain('DOCUMENT_NOT_FOUND');
    });

    it('should return 200 with document details when document belongs to tenant', async () => {
      // Ingest document first
      const ingested = await IntakeService.ingestDocument({
        tenantId: 'TNT-CORP-01',
        userId: 'USR-88210',
        buffer: validPdfBuffer,
        originalFilename: 'details_test.pdf',
        declaredMimeType: 'application/pdf',
      });

      const req = {
        originalUrl: `/api/v1/documents/${ingested.documentId}`,
        params: { id: ingested.documentId },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['DOC_VIEW'] },
      } as unknown as AuthenticatedRequest;

      const { res, getStatus, getBody } = createMockResponse();
      const next = jest.fn();

      await getDocumentDetailHandler(req, res, next);

      expect(getStatus()).toBe(200);
      expect(getBody().data.documentId).toBe(ingested.documentId);
      expect(getBody().data.tenantId).toBe('TNT-CORP-01');
      expect(getBody().data.fileName).toBe('details_test.pdf');
    });
  });
});
