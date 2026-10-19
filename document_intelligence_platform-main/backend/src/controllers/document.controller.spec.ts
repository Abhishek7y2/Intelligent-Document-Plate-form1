import { Response } from 'express';
import { listDocumentsHandler } from './document.controller.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

describe('Sprint 2: Multi-Tenant Isolation on Document Controller', () => {
  it('should only return documents belonging to Tenant A for a Tenant A user', async () => {
    const mockReq = {
      query: { page: '1', pageSize: '10' },
      user: {
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        role: 'Reviewer',
        tenantId: 'TNT-CORP-01', // Tenant A
        permissions: ['DOC_VIEW'],
      },
    } as unknown as AuthenticatedRequest;

    let responseJson: any = null;
    let responseStatus: number = 0;

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

    await listDocumentsHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.tenantId).toBe('TNT-CORP-01');
    expect(Array.isArray(responseJson.data)).toBe(true);
    for (const doc of responseJson.data) {
      expect(doc.tenantId).toBe('TNT-CORP-01');
    }
  });

  it('should isolate Tenant B and prevent viewing Tenant A documents', async () => {
    const mockReq = {
      query: { page: '1', pageSize: '10' },
      user: {
        userId: 'USR-AUDIT-01',
        email: 'auditor@docunexa.io',
        role: 'Auditor',
        tenantId: 'TNT-CORP-02', // Tenant B
        permissions: ['DOC_VIEW'],
      },
    } as unknown as AuthenticatedRequest;

    let responseJson: any = null;
    let responseStatus: number = 0;

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

    await listDocumentsHandler(mockReq, mockRes, mockNext);

    expect(responseStatus).toBe(200);
    expect(responseJson.tenantId).toBe('TNT-CORP-02');
    // None of Tenant A's documents should be returned
    expect(responseJson.data.length).toBe(0);
  });
});
