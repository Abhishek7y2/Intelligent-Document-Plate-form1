import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpQaService, BackendQaQueryResponse } from './http-qa.service';
import { ApiClient } from '../api/api-client';

describe('HttpQaService (DocuNexa Sprint 10 Angular Integration)', () => {
  let service: HttpQaService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (_path: string, _params?: any) => of({ documents: [] }),
      post: (_path: string, _body?: any) => of({}),
    };

    service = new HttpQaService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should post question to /qa/query and map answer with citations', () => {
    const mockResponse: BackendQaQueryResponse = {
      answer: 'Payment is due Net 30 days from invoice date.',
      confidence: 0.95,
      citations: [
        {
          citationId: 'CITE-001',
          documentId: 'DOC-10248',
          documentTitle: 'Supplier Agreement - Acme Industries',
          version: 'v2.0',
          page: 4,
          paragraph: 2,
          snippet: 'Payment shall be made within 30 days.',
        },
      ],
      isAbstention: false,
      hasConflicts: false,
      freshness: [
        {
          documentId: 'DOC-10248',
          currentVersion: 'v2.0',
          latestVersion: 'v3.0',
          isSuperseded: true,
        },
      ],
      traceId: 'TRACE-001',
      correlationId: 'CORR-001',
    };

    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/qa/query');
      expect(body.question).toBe('What are the payment terms?');
      expect(body.documentId).toBe('DOC-10248');
      return of(mockResponse);
    };

    let mappedResult: any;
    service.askQuestion('What are the payment terms?', 'DOC-10248').subscribe((result) => {
      mappedResult = result;
    });

    expect(mappedResult).toBeDefined();
    expect(mappedResult.answer).toContain('Net 30 days');
    expect(mappedResult.confidence).toBe(0.95);
    expect(mappedResult.citations.length).toBe(1);
    expect(mappedResult.citations[0].docId).toBe('DOC-10248');
    expect(mappedResult.citations[0].page).toBe(4);
    expect(mappedResult.freshness?.[0].isSuperseded).toBe(true);
  });

  it('should verify citation click-time access against /qa/citations/verify', () => {
    const mockVerification = {
      allowed: true,
      documentId: 'DOC-10248',
      title: 'Supplier Agreement',
      version: 'v2.0',
    };

    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/qa/citations/verify');
      expect(body.documentId).toBe('DOC-10248');
      expect(body.citationId).toBe('CITE-001');
      return of(mockVerification);
    };

    let verifyResult: any;
    service.verifyCitation('DOC-10248', 'CITE-001').subscribe((res) => {
      verifyResult = res;
    });

    expect(verifyResult).toBeDefined();
    expect(verifyResult.allowed).toBe(true);
    expect(verifyResult.documentId).toBe('DOC-10248');
  });

  it('should fetch available authorized documents from /qa/documents', () => {
    const mockDocs = [
      { id: 'DOC-10248', name: 'Supplier Agreement', type: 'Supplier Contract', currentVersion: 'v2.0' },
      { id: 'DOC-10247', name: 'Purchase Invoice', type: 'Purchase Invoice', currentVersion: 'v2.0' },
    ];

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/qa/documents');
      return of({ documents: mockDocs });
    };

    let retrievedDocs: any;
    service.getAvailableDocuments().subscribe((docs) => {
      retrievedDocs = docs;
    });

    expect(retrievedDocs).toBeDefined();
    expect(retrievedDocs.length).toBe(2);
    expect(retrievedDocs[0].id).toBe('DOC-10248');
  });

  it('should submit trace feedback to /qa/traces/:traceId/feedback', () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/qa/traces/TRACE-001/feedback');
      expect(body.feedback).toBe('THUMBS_UP');
      return of({ success: true });
    };

    let feedbackSubmitted = false;
    service.submitFeedback('TRACE-001', 'THUMBS_UP', 'Very helpful answer').subscribe((ok) => {
      feedbackSubmitted = ok;
    });

    expect(feedbackSubmitted).toBe(true);
  });
});
