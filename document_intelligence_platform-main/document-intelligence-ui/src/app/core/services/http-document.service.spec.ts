import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpDocumentService } from './http-document.service';
import { ApiClient } from '../api/api-client';

describe('HttpDocumentService', () => {
  let service: HttpDocumentService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (path: string, params?: any) => of({ data: [] }),
      post: (path: string, body: any) => of({ success: true }),
      delete: (path: string) => of({ success: true }),
    };

    service = new HttpDocumentService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch documents from /documents and map to IDocumentItem[]', () => {
    const mockResponse = {
      data: [
        {
          id: 'DOC-10247',
          tenantId: 'TNT-CORP-01',
          title: 'Master Service Agreement - Vendor Corp',
          docType: 'LOAN_AGREEMENT',
          status: 'NEEDS_REVIEW',
          confidence: 0.82,
          slaStatus: 'WARNING',
          source: 'EMAIL_INGEST',
          pages: 14,
          owner: 'Abhishek Yadav',
          uploadedAt: '2026-10-13T07:00:00.000Z',
        },
      ],
      pagination: { totalItems: 1, page: 1, pageSize: 20, totalPages: 1 },
    };

    apiClientSpy.get = (path: string, params?: any) => {
      expect(path).toBe('/documents');
      return of(mockResponse);
    };

    service.getDocuments().subscribe((docs) => {
      expect(docs.length).toBe(1);
      expect(docs[0].id).toBe('DOC-10247');
      expect(docs[0].name).toBe('Master Service Agreement - Vendor Corp');
      expect(docs[0].owner).toBe('Abhishek Yadav');
      expect(docs[0].ownerInitials).toBe('AY');
      expect(docs[0].confidence).toBe(82);
      expect(docs[0].pages).toBe(14);
      expect(docs[0].status).toBe('NEEDS_REVIEW');
    });
  });

  it('should fetch single document by ID from /documents/:id', () => {
    const mockDoc = {
      id: 'DOC-10248',
      title: 'Supplier Agreement',
      docType: 'Supplier Contract',
      status: 'Approved',
      confidence: 0.95,
      pages: 18,
      owner: 'Rahul Sharma',
    };

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/documents/DOC-10248');
      return of({ data: mockDoc });
    };

    service.getDocumentById('DOC-10248').subscribe((doc) => {
      expect(doc).toBeTruthy();
      expect(doc!.id).toBe('DOC-10248');
      expect(doc!.name).toBe('Supplier Agreement');
      expect(doc!.owner).toBe('Rahul Sharma');
      expect(doc!.ownerInitials).toBe('RS');
      expect(doc!.confidence).toBe(95);
    });
  });

  it('should return null when document is not found or API errors', () => {
    apiClientSpy.get = () => throwError(() => new Error('Not found'));

    service.getDocumentById('DOC-NONEXISTENT').subscribe((doc) => {
      expect(doc).toBeNull();
    });
  });

  it('should return empty list when getDocuments fails', () => {
    apiClientSpy.get = () => throwError(() => new Error('Network error'));

    service.getDocuments().subscribe((docs) => {
      expect(docs).toEqual([]);
    });
  });

  it('should route deletion through retention cases workflow and return true on success', () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/retention/cases');
      expect(body.documentId).toBe('DOC-10248');
      return of({ success: true, caseId: 'DEL-CASE-103' });
    };

    service.deleteDocument('DOC-10248').subscribe((res) => {
      expect(res).toBe(true);
    });
  });

  it('should upload document to /documents/upload with idempotency header', () => {
    const mockFile = new File(['mock content'], 'test-invoice.pdf', { type: 'application/pdf' });
    let postedPath = '';

    apiClientSpy.post = (path: string, formData: any, headers: any) => {
      postedPath = path;
      return of({ success: true, documentId: 'DOC-10249' });
    };

    service.uploadDocument(mockFile, 'purchase-invoice', { idempotencyKey: 'IDEM-TEST-123' }).subscribe((res) => {
      expect(postedPath).toBe('/documents/upload');
      expect(res.success).toBe(true);
    });
  });
});
