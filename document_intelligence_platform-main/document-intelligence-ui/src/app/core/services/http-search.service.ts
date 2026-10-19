import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { ISearchService, ISearchResult } from './api-services';

export interface BackendSearchResultItem {
  docId: string;
  title: string;
  category: string;
  status: string;
  matchScore: number;
  snippet: string;
  highlightedSnippet?: string;
  pageNumber: number;
  sourceVersion: string;
  updatedAt: string;
  confidence?: number;
}

export interface BackendSearchResponse {
  query: string;
  totalMatches: number;
  results: BackendSearchResultItem[];
}

@Injectable({
  providedIn: 'root',
})
export class HttpSearchService implements ISearchService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  semanticSearch(query: string): Observable<ISearchResult[]> {
    return this.api
      .get<BackendSearchResponse>('/search', { q: query || 'contract' })
      .pipe(
        map((response: BackendSearchResponse) =>
          response.results.map((r) => ({
            docId: r.docId,
            title: r.title,
            snippet: r.snippet,
            matchScore: r.matchScore,
            category: r.category,
          }))
        )
      );
  }
}
