import { Response } from 'express';
import { compareDocumentsHandler, getComparisonHandler } from './compare.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CompareService } from '../services/compare.service.js';
import { IntakeService } from '../services/intake.service.js';

describe('CompareController (FR-012 Version Comparison API Contract)', () => {
  const tenantId = 'TNT-CORP-01';

  beforeEach(() => {
    CompareService.setStoreMode('memory');
    CompareService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10245-v1',
      tenantId,
      fileName: 'Agreement_v1.0.pdf',
      storagePath: '/tenants/TNT-CORP-01/v1.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      sha256Hash: 'f1e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 12,
      uploadedAt: new Date('2026-01-15T10:00:00Z'),
    });

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10245-v2',
      tenantId,
      fileName: 'Agreement_v2.0.pdf',
      storagePath: '/tenants/TNT-CORP-01/v2.pdf',
      fileSizeBytes: 2148576,
      mimeType: 'application/pdf',
      sha256Hash: 'f2e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef1',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.96,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 14,
      uploadedAt: new Date('2026-10-06T10:00:00Z'),
    });
  });

  it('should handle POST /compare with document IDs', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        documentId1: 'DOC-10245-v1',
        documentId2: 'DOC-10245-v2',
      },
      user: {
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        role: 'Reviewer',
        tenantId,
        permissions: ['COMPARE_VIEW'],
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

    const mockNext = jest.fn();

    await compareDocumentsHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.comparisonId).toBeDefined();
    expect(responseJson.document1.id).toBe('DOC-10245-v1');
    expect(responseJson.document2.id).toBe('DOC-10245-v2');
    expect(responseJson.summary.totalClauses).toBe(4);
    expect(responseJson.clauses.length).toBe(4);
  });

  it('should return 400 when documentId parameters are missing', async () => {
    const mockReq = {
      method: 'POST',
      body: {},
      user: {
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        role: 'Reviewer',
        tenantId,
        permissions: ['COMPARE_VIEW'],
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

    const mockNext = jest.fn();

    await compareDocumentsHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(400);
    expect(responseJson.detail).toContain('Both documentId1 and documentId2');
  });

  it('should handle GET /compare/:id for retrieving historical comparison', async () => {
    const comparison = await CompareService.compareDocuments(
      'DOC-10245-v1',
      'DOC-10245-v2',
      tenantId
    );

    const mockReq = {
      params: { id: comparison.comparisonId },
      user: {
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        role: 'Reviewer',
        tenantId,
        permissions: ['COMPARE_VIEW'],
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

    const mockNext = jest.fn();

    await getComparisonHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.comparisonId).toBe(comparison.comparisonId);
  });
});
