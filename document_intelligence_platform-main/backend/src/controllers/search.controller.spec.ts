import { Response } from 'express';
import { searchHandler, indexDocumentHandler } from './search.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SearchService } from '../services/search.service.js';
import { IntakeService } from '../services/intake.service.js';

describe('SearchController (FR-014 API Contract & Tenant Isolation)', () => {
  const tenantId = 'TNT-CORP-01';

  beforeEach(async () => {
    SearchService.setStoreMode('memory');
    SearchService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-10248',
      tenantId,
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

    await SearchService.indexDocument('DOC-10248', tenantId);
  });

  it('should handle GET /search with query parameters', async () => {
    const mockReq = {
      method: 'GET',
      query: { q: 'Acme supplier agreement', type: 'Supplier Contract', page: '1', pageSize: '10' },
      user: {
        userId: 'USR-88210',
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

    const mockNext = jest.fn();

    await searchHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.query).toBe('Acme supplier agreement');
    expect(responseJson.totalMatches).toBeGreaterThan(0);
    expect(responseJson.results[0].docId).toBe('DOC-10248');
  });

  it('should handle POST /search with JSON body filters', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        query: 'Acme',
        filters: { documentType: 'Supplier Contract' },
        limit: 5,
        offset: 0,
      },
      user: {
        userId: 'USR-88210',
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

    const mockNext = jest.fn();

    await searchHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.totalMatches).toBe(1);
    expect(responseJson.facets?.byType?.['Supplier Contract']).toBe(1);
  });

  it('should handle POST /search/index/:id for on-demand re-indexing', async () => {
    const mockReq = {
      method: 'POST',
      params: { id: 'DOC-10248' },
      body: { force: true },
      user: {
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        role: 'Admin',
        tenantId,
        permissions: ['DOC_EDIT'],
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

    await indexDocumentHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.status).toBe('INDEXED');
    expect(responseJson.chunksIndexed).toBeGreaterThan(0);
  });
});
