import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpSearchService, BackendSearchResponse } from './http-search.service';
import { ApiClient } from '../api/api-client';

describe('HttpSearchService (Sprint 9 Angular Integration)', () => {
  let service: HttpSearchService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (_path: string, _params: any) => of({ query: '', totalMatches: 0, results: [] }),
    };

    service = new HttpSearchService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call /search API and map backend results to ISearchResult array', () => {
    const mockBackendResponse: BackendSearchResponse = {
      query: 'liability clause',
      totalMatches: 1,
      results: [
        {
          docId: 'DOC-10248',
          title: 'Master Supplier Agreement',
          category: 'Supplier Contract',
          status: 'APPROVED',
          matchScore: 0.94,
          snippet: 'Maximum Liability & Penalty Cap is limited to 100%...',
          pageNumber: 3,
          sourceVersion: 'v1.0',
          updatedAt: '2026-10-07T12:00:00Z',
        },
      ],
    };

    apiClientSpy.get = (path: string, params: any) => {
      expect(path).toBe('/search');
      expect(params.q).toBe('liability clause');
      return of(mockBackendResponse);
    };

    service.semanticSearch('liability clause').subscribe((results) => {
      expect(results.length).toBe(1);
      expect(results[0]?.docId).toBe('DOC-10248');
      expect(results[0]?.title).toBe('Master Supplier Agreement');
      expect(results[0]?.category).toBe('Supplier Contract');
      expect(results[0]?.matchScore).toBe(0.94);
      expect(results[0]?.snippet).toContain('Maximum Liability');
    });
  });

  it('should handle default query when empty string provided', () => {
    apiClientSpy.get = (path: string, params: any) => {
      expect(path).toBe('/search');
      expect(params.q).toBe('contract');
      return of({ query: 'contract', totalMatches: 0, results: [] });
    };

    service.semanticSearch('').subscribe((results) => {
      expect(results).toEqual([]);
    });
  });
});
