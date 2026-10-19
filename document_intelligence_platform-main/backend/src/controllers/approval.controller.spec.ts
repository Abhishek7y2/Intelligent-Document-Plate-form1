import { Request, Response } from 'express';
import {
  getApprovalQueueHandler,
  getApprovalDetailsHandler,
  submitApprovalDecisionHandler,
} from './approval.controller.js';
import { ApprovalService } from '../services/approval.service.js';
import { IntakeService } from '../services/intake.service.js';
import { ExtractionService } from '../services/extraction.service.js';
import { ErpPublisherService } from '../services/erp-publisher.service.js';
import { DocumentExtractionResult } from '../models/extraction.models.js';

describe('ApprovalController (HTTP & RFC 7807 Spec Tests)', () => {
  const tenantId = 'TNT-CORP-01';

  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const setupDoc = (docId: string, assignedTo = 'OTHER-UPLOADER', status: any = 'NEEDS_REVIEW') => {
    IntakeService.setInMemoryDocument({
      documentId: docId,
      tenantId,
      fileName: `${docId}.pdf`,
      storagePath: `tenants/${tenantId}/${docId}.pdf`,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      sha256Hash: `hash-${docId}`,
      documentType: 'purchase-invoice',
      status,
      stage: 'REVIEW_COMPLETED',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      assignedTo,
      pageCount: 1,
      uploadedAt: new Date(),
    });
  };

  const setupExtraction = (docId: string, total = 2000) => {
    const extraction: DocumentExtractionResult = {
      extractionId: `EXT-${docId}`,
      documentId: docId,
      tenantId,
      documentType: 'purchase-invoice',
      templateVersion: 'v2.1',
      fields: [
        {
          fieldId: `F-1-${docId}`,
          fieldName: 'invoice_number',
          label: 'Invoice Number',
          dataType: 'string',
          extractedValue: 'INV-100',
          confidence: 0.95,
          status: 'EXTRACTED',
        },
        {
          fieldId: `F-2-${docId}`,
          fieldName: 'total_amount',
          label: 'Total Amount',
          dataType: 'number',
          extractedValue: total,
          confidence: 0.95,
          status: 'EXTRACTED',
        },
      ],
      validationSummary: {
        isValid: true,
        totalFieldsExpected: 2,
        totalFieldsExtracted: 2,
        missingRequiredFields: [],
        lowConfidenceFields: [],
        reconciliationResult: {
          status: 'MATCHED',
          netAmount: total * 0.8,
          taxAmount: total * 0.2,
          totalAmount: total,
          expectedTotal: total,
          delta: 0,
          isReconciled: true,
        },
      },
      routingDecision: 'NEEDS_REVIEW',
      extractedAt: new Date().toISOString(),
    };
    ExtractionService.saveExtractionResult(extraction);
  };

  beforeEach(() => {
    IntakeService.clearInMemory();
    ExtractionService.clearInMemory();
    ApprovalService.resetState();
    ErpPublisherService.resetState();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockReq = {
      user: {
        userId: 'USR-APPROVER-01',
        email: 'approver@docunexa.com',
        role: 'Approver',
        tenantId,
        permissions: ['DOC_VIEW', 'DOC_APPROVE'],
      },
      params: {},
      body: {},
      originalUrl: '/api/v1/approvals',
    };
  });

  describe('GET /approvals/queue', () => {
    it('should return 200 OK with approval queue items', async () => {
      setupDoc('DOC-APP-Q1', 'USR-UPLOADER-99');

      await getApprovalQueueHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalled();
      const body = jsonMock.mock.calls[0][0];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].documentId).toBe('DOC-APP-Q1');
    });
  });

  describe('GET /approvals/:id', () => {
    it('should return 200 OK with approval details for valid document', async () => {
      mockReq.params = { id: 'DOC-APP-DETAIL-1' };
      setupDoc('DOC-APP-DETAIL-1', 'USR-UPLOADER-99');

      await getApprovalDetailsHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      const body = jsonMock.mock.calls[0][0];
      expect(body.documentId).toBe('DOC-APP-DETAIL-1');
      expect(body.status).toBe('PENDING');
    });

    it('should return 404 RFC 7807 when document does not exist', async () => {
      mockReq.params = { id: 'NON-EXISTENT-DOC' };

      await getApprovalDetailsHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
          status: 404,
        })
      );
    });
  });

  describe('POST /approvals/:id/decide', () => {
    it('should return 400 RFC 7807 when action is missing in request body', async () => {
      mockReq.params = { id: 'DOC-DEC-1' };
      mockReq.body = {};

      await submitApprovalDecisionHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/INVALID_REQUEST',
          status: 400,
        })
      );
    });

    it('should return 403 RFC 7807 when submitter attempts self-approval (SoD violation)', async () => {
      mockReq.params = { id: 'DOC-DEC-SOD' };
      mockReq.body = { action: 'APPROVE', reasonCode: 'Verified & Compliant' };

      // Set user as uploader
      mockReq.user.userId = 'USR-SAME-UPLOADER';
      mockReq.user.email = 'uploader@docunexa.com';

      setupDoc('DOC-DEC-SOD', 'USR-SAME-UPLOADER');

      await submitApprovalDecisionHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.docunexa.enterprise/errors/SOD_VIOLATION_SUBMITTER',
          status: 403,
        })
      );
    });

    it('should return 200 OK when decision is successfully recorded', async () => {
      mockReq.params = { id: 'DOC-DEC-OK' };
      mockReq.body = { action: 'APPROVE', reasonCode: 'Verified & Compliant' };

      setupDoc('DOC-DEC-OK', 'OTHER-UPLOADER');
      setupExtraction('DOC-DEC-OK', 2000);

      await submitApprovalDecisionHandler(mockReq as any, mockRes as any);

      expect(statusMock).toHaveBeenCalledWith(200);
      const resData = jsonMock.mock.calls[0][0];
      expect(resData.isFullyApproved).toBe(true);
      expect(resData.published).toBe(true);
      expect(resData.request.status).toBe('APPROVED');
    });
  });
});
