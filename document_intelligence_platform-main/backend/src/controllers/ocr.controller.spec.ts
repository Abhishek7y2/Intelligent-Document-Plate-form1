import { Response } from 'express';
import {
  processOcrHandler,
  getOcrResultHandler,
  getPageGeometryHandler,
} from './ocr.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { OcrService } from '../services/ocr.service.js';
import { IntakeService } from '../services/intake.service.js';
import { SyntheticMockOcrAdapter } from '../services/mock-ocr.adapter.js';
import { DocumentRecord } from '../models/intake.models.js';

describe('Sprint 5: OCR Controller Endpoints & RFC 7807 Responses', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(() => {
    IntakeService.clearInMemory();
    OcrService.clearInMemory();
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

  describe('POST /api/v1/documents/:id/process-ocr', () => {
    it('should return 401 when authentication token is missing tenantId', async () => {
      const req = {
        params: { id: 'DOC-123' },
        user: undefined,
        originalUrl: '/api/v1/documents/DOC-123/process-ocr',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await processOcrHandler(req, res, jest.fn());

      expect(getStatus()).toBe(401);
      expect(getBody().type).toContain('UNAUTHORIZED');
    });

    it('should return 403 RFC 7807 problem details when document is quarantined', async () => {
      const quarantinedDoc: DocumentRecord = {
        documentId: 'DOC-MALWARE-99',
        tenantId: tenantA,
        fileName: 'infected.pdf',
        storagePath: 'tenants/TNT-CORP-01/quarantine/DOC-MALWARE-99.pdf',
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
        quarantineReason: 'EICAR-Test-Signature detected',
      };
      IntakeService.setInMemoryDocument(quarantinedDoc);

      const req = {
        params: { id: 'DOC-MALWARE-99' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_EDIT'] },
        originalUrl: '/api/v1/documents/DOC-MALWARE-99/process-ocr',
        body: {},
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await processOcrHandler(req, res, jest.fn());

      expect(getStatus()).toBe(403);
      expect(getBody().type).toContain('DOCUMENT_QUARANTINED');
      expect(getBody().title).toContain('quarantined due to malware');
    });

    it('should return 404 when document does not exist', async () => {
      const req = {
        params: { id: 'DOC-NONEXISTENT' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_EDIT'] },
        originalUrl: '/api/v1/documents/DOC-NONEXISTENT/process-ocr',
        body: {},
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await processOcrHandler(req, res, jest.fn());

      expect(getStatus()).toBe(404);
      expect(getBody().type).toContain('DOCUMENT_NOT_FOUND');
    });

    it('should return 200 OK with normalized OCR geometry on successful processing', async () => {
      const rawPdf = Buffer.from('%PDF-1.4\n valid pdf invoice \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-SUCCESS-01.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const queuedDoc: DocumentRecord = {
        documentId: 'DOC-SUCCESS-01',
        tenantId: tenantA,
        fileName: 'invoice.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: 'e'.repeat(64),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(queuedDoc);

      const req = {
        params: { id: 'DOC-SUCCESS-01' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_EDIT'] },
        originalUrl: '/api/v1/documents/DOC-SUCCESS-01/process-ocr',
        body: {},
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await processOcrHandler(req, res, jest.fn());

      expect(getStatus()).toBe(200);
      expect(getBody().status).toBe('SUCCESS');
      expect(getBody().data.documentId).toBe('DOC-SUCCESS-01');
      expect(getBody().data.pages.length).toBeGreaterThan(0);
      expect(getBody().data.fullText).toContain('TAX INVOICE');
    });

    it('should return 409 RFC 7807 problem details when document is actively processing', async () => {
      const processingDoc: DocumentRecord = {
        documentId: 'DOC-ACTIVE-01',
        tenantId: tenantA,
        fileName: 'active.pdf',
        storagePath: 'tenants/TNT-CORP-01/raw/DOC-ACTIVE-01.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'a1'.repeat(32),
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

      const req = {
        params: { id: 'DOC-ACTIVE-01' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_EDIT'] },
        originalUrl: '/api/v1/documents/DOC-ACTIVE-01/process-ocr',
        body: {},
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await processOcrHandler(req, res, jest.fn());

      expect(getStatus()).toBe(409);
      expect(getBody().type).toContain('DOCUMENT_ALREADY_PROCESSING');
      expect(getBody().title).toContain('already undergoing active OCR processing');
    });

    it('should return 504 RFC 7807 problem details when OCR operation times out', async () => {
      OcrService.setEngine(new SyntheticMockOcrAdapter('timeout'));
      const rawPdf = Buffer.from('%PDF-1.4\n timeout pdf \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-TIMEOUT-CTRL.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const queuedDoc: DocumentRecord = {
        documentId: 'DOC-TIMEOUT-CTRL',
        tenantId: tenantA,
        fileName: 'timeout.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: 'a2'.repeat(32),
        documentType: 'purchase-invoice',
        status: 'QUEUED',
        stage: 'INGESTION_COMPLETE',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      };
      IntakeService.setInMemoryDocument(queuedDoc);

      const req = {
        params: { id: 'DOC-TIMEOUT-CTRL' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_EDIT'] },
        originalUrl: '/api/v1/documents/DOC-TIMEOUT-CTRL/process-ocr',
        body: {},
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await processOcrHandler(req, res, jest.fn());

      expect(getStatus()).toBe(504);
      expect(getBody().type).toContain('OCR_TIMEOUT');
    });
  });

  describe('GET /api/v1/documents/:id/ocr', () => {
    it('should return 404 when OCR result is not yet available', async () => {
      const req = {
        params: { id: 'DOC-UNPROCESSED' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_VIEW'] },
        originalUrl: '/api/v1/documents/DOC-UNPROCESSED/ocr',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await getOcrResultHandler(req, res, jest.fn());

      expect(getStatus()).toBe(404);
      expect(getBody().type).toContain('OCR_NOT_FOUND');
    });

    it('should return 200 OK and prevent cross-tenant access to OCR data', async () => {
      const rawPdf = Buffer.from('%PDF-1.4\n valid pdf invoice \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-TENANT-ISO.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-TENANT-ISO',
        tenantId: tenantA,
        fileName: 'invoice.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: 'f'.repeat(64),
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
      await OcrService.processDocument('DOC-TENANT-ISO', tenantA);

      // Same tenant retrieval -> 200 OK
      const reqA = {
        params: { id: 'DOC-TENANT-ISO' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_VIEW'] },
        originalUrl: '/api/v1/documents/DOC-TENANT-ISO/ocr',
      } as unknown as AuthenticatedRequest;
      const resA = createMockResponse();
      await getOcrResultHandler(reqA, resA.res, jest.fn());
      expect(resA.getStatus()).toBe(200);

      // Foreign tenant retrieval -> 404 (strictly fenced)
      const reqB = {
        params: { id: 'DOC-TENANT-ISO' },
        user: { userId: 'USR-99999', tenantId: tenantB, role: 'Reviewer', permissions: ['DOC_VIEW'] },
        originalUrl: '/api/v1/documents/DOC-TENANT-ISO/ocr',
      } as unknown as AuthenticatedRequest;
      const resB = createMockResponse();
      await getOcrResultHandler(reqB, resB.res, jest.fn());
      expect(resB.getStatus()).toBe(404);
    });
  });

  describe('GET /api/v1/documents/:id/pages/:pageNumber/geometry', () => {
    it('should return 400 for invalid page numbers (e.g. 0 or negative)', async () => {
      const req = {
        params: { id: 'DOC-VALID', pageNumber: '0' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_VIEW'] },
        originalUrl: '/api/v1/documents/DOC-VALID/pages/0/geometry',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await getPageGeometryHandler(req, res, jest.fn());

      expect(getStatus()).toBe(400);
      expect(getBody().type).toContain('INVALID_PAGE_NUMBER');
    });

    it('should return 200 OK with page bounding boxes and word tokens', async () => {
      const rawPdf = Buffer.from('%PDF-1.4\n valid pdf invoice \n%%EOF');
      const storageKey = 'tenants/TNT-CORP-01/raw/DOC-PAGE-GEOM.pdf';
      await IntakeService.getStorage().putObject(storageKey, rawPdf);

      const doc: DocumentRecord = {
        documentId: 'DOC-PAGE-GEOM',
        tenantId: tenantA,
        fileName: 'invoice.pdf',
        storagePath: storageKey,
        fileSizeBytes: rawPdf.length,
        mimeType: 'application/pdf',
        sha256Hash: '9'.repeat(64),
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
      await OcrService.processDocument('DOC-PAGE-GEOM', tenantA);

      const req = {
        params: { id: 'DOC-PAGE-GEOM', pageNumber: '1' },
        user: { userId: 'USR-88210', tenantId: tenantA, role: 'Reviewer', permissions: ['DOC_VIEW'] },
        originalUrl: '/api/v1/documents/DOC-PAGE-GEOM/pages/1/geometry',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockResponse();

      await getPageGeometryHandler(req, res, jest.fn());

      expect(getStatus()).toBe(200);
      expect(getBody().status).toBe('SUCCESS');
      expect(getBody().data.pageNumber).toBe(1);
      expect(getBody().data.width).toBe(2550);
      expect(getBody().data.height).toBe(3300);
      expect(getBody().data.words.length).toBeGreaterThan(0);
      expect(getBody().data.words[0].bbox).toBeDefined();
      expect(getBody().data.words[0].polygon).toHaveLength(8);
    });
  });
});
