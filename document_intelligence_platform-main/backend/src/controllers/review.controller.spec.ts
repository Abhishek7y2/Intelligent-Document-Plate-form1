import { Request, Response } from 'express';
import {
  getReviewQueueHandler,
  getReviewWorkbenchHandler,
  correctFieldHandler,
  submitReviewDecisionHandler,
  getReviewAuditLogsHandler,
} from './review.controller.js';
import { ReviewService } from '../services/review.service.js';
import { IntakeService } from '../services/intake.service.js';
import { ExtractionService } from '../services/extraction.service.js';

describe('ReviewController (HTTP & RFC 7807 Spec Tests)', () => {
  const tenantId = 'TNT-CORP-01';

  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    IntakeService.clearInMemory();
    ExtractionService.clearInMemory();
    ReviewService.clearInMemory();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockReq = {
      user: {
        userId: 'USR-REVIEWER-01',
        email: 'reviewer@docunexa.com',
        role: 'Reviewer',
        tenantId,
        permissions: ['DOC_VIEW', 'DOC_EDIT', 'DOC_VERIFY'],
      },
      params: {},
      body: {},
      originalUrl: '/api/v1/review',
    };
  });

  describe('GET /review/queue', () => {
    it('should return 200 OK with review tasks array', async () => {
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-QUEUE-1',
        tenantId,
        fileName: 'Invoice1.pdf',
        storagePath: 'tenants/TNT-CORP-01/Invoice1.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-1',
        documentType: 'purchase-invoice',
        status: 'NEEDS_REVIEW',
        stage: 'HITL_REVIEW_PENDING',
        confidenceScore: 0.75,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      await getReviewQueueHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ docId: 'DOC-QUEUE-1' })]));
    });

    it('should return 401 UNAUTHORIZED if tenant context is missing', async () => {
      mockReq.user = undefined;
      await getReviewQueueHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        })
      );
    });
  });

  describe('GET /review/:id', () => {
    it('should return 200 OK with review workbench aggregate data', async () => {
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-DETAIL-1',
        tenantId,
        fileName: 'InvoiceDetail.pdf',
        storagePath: 'tenants/TNT-CORP-01/InvoiceDetail.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-detail',
        documentType: 'purchase-invoice',
        status: 'NEEDS_REVIEW',
        stage: 'HITL_REVIEW_PENDING',
        confidenceScore: 0.85,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      mockReq.params = { id: 'DOC-DETAIL-1' };
      await getReviewWorkbenchHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'DOC-DETAIL-1',
          status: 'NEEDS_REVIEW',
        })
      );
    });

    it('should return 404 DOCUMENT_NOT_FOUND when document does not exist', async () => {
      mockReq.params = { id: 'NONEXISTENT' };
      await getReviewWorkbenchHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        })
      );
    });

    it('should return 403 DOCUMENT_QUARANTINED when document is quarantined', async () => {
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-QUARANTINED',
        tenantId,
        fileName: 'Virus.pdf',
        storagePath: 'tenants/TNT-CORP-01/Virus.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-virus',
        documentType: 'purchase-invoice',
        status: 'QUARANTINED',
        stage: 'MALWARE_DETECTED',
        confidenceScore: null,
        slaStatus: 'BREACHED',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      mockReq.params = { id: 'DOC-QUARANTINED' };
      await getReviewWorkbenchHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/DOCUMENT_QUARANTINED',
        })
      );
    });
  });

  describe('POST /review/:id/fields/:key', () => {
    it('should return 400 INVALID_PAYLOAD when correctedValue is missing', async () => {
      mockReq.params = { id: 'DOC-1', key: 'invoice_number' };
      mockReq.body = {};

      await correctFieldHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/INVALID_PAYLOAD',
        })
      );
    });
  });

  describe('POST /review/:id/decision', () => {
    it('should return 400 INVALID_ACTION when action is not recognized', async () => {
      mockReq.params = { id: 'DOC-1' };
      mockReq.body = { action: 'UNKNOWN_ACTION' };

      await submitReviewDecisionHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/INVALID_ACTION',
        })
      );
    });

    it('should return 200 OK and update status when APPROVE is submitted', async () => {
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-APPROVE-TEST',
        tenantId,
        fileName: 'InvoiceApprove.pdf',
        storagePath: 'tenants/TNT-CORP-01/InvoiceApprove.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-approve',
        documentType: 'purchase-invoice',
        status: 'NEEDS_REVIEW',
        stage: 'HITL_REVIEW_PENDING',
        confidenceScore: 0.85,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      mockReq.params = { id: 'DOC-APPROVE-TEST' };
      mockReq.body = { action: 'APPROVE', comments: 'Looks good' };

      await submitReviewDecisionHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          newStatus: 'APPROVED',
          newStage: 'REVIEW_COMPLETED',
        })
      );
    });
  });

  describe('GET /review/:id/audit', () => {
    it('should return 200 OK with auditLogs array', async () => {
      IntakeService.setInMemoryDocument({
        documentId: 'DOC-AUDIT-1',
        tenantId,
        fileName: 'Audit.pdf',
        storagePath: 'tenants/TNT-CORP-01/Audit.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-audit',
        documentType: 'purchase-invoice',
        status: 'NEEDS_REVIEW',
        stage: 'HITL_REVIEW_PENDING',
        confidenceScore: 0.85,
        slaStatus: 'ON_TRACK',
        ingestionSource: 'MANUAL_UPLOAD',
        pageCount: 1,
        uploadedAt: new Date(),
      });

      mockReq.params = { id: 'DOC-AUDIT-1' };
      await getReviewAuditLogsHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ auditLogs: expect.any(Array) }));
    });
  });
});
