import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { IQaService, IQaAnswer, IQaCitationVerification, IQaDocumentInfo } from './api-services';

export interface BackendCitation {
  citationId: string;
  documentId: string;
  documentTitle: string;
  version: string;
  page?: number;
  paragraph?: number;
  snippet: string;
  isRestricted?: boolean;
}

export interface BackendQaQueryResponse {
  answer: string;
  confidence: number;
  citations: BackendCitation[];
  isAbstention: boolean;
  abstentionReason?: string;
  hasConflicts: boolean;
  conflicts?: Array<{ documentId: string; description: string; versions: string[] }>;
  freshness?: Array<{ documentId: string; currentVersion: string; latestVersion: string; isSuperseded: boolean }>;
  traceId: string;
  correlationId: string;
}

export interface BackendDocumentsResponse {
  documents: IQaDocumentInfo[];
}

@Injectable({
  providedIn: 'root',
})
export class HttpQaService implements IQaService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  askQuestion(question: string, documentId?: string): Observable<IQaAnswer> {
    const payload: { question: string; documentId?: string } = { question };
    if (documentId) {
      payload.documentId = documentId;
    }

    return this.api.post<BackendQaQueryResponse>('/qa/query', payload).pipe(
      map((res: BackendQaQueryResponse) => ({
        answer: res.answer,
        confidence: res.confidence,
        citations: (res.citations || []).map((c: BackendCitation) => ({
          docId: c.documentId,
          page: c.page || 1,
          paragraph: c.paragraph || 1,
          snippet: c.snippet,
        })),
        isAbstention: res.isAbstention,
        abstentionReason: res.abstentionReason,
        hasConflicts: res.hasConflicts,
        conflicts: res.conflicts,
        freshness: res.freshness,
        traceId: res.traceId,
      }))
    );
  }

  verifyCitation(documentId: string, citationId?: string): Observable<IQaCitationVerification> {
    return this.api.post<IQaCitationVerification>('/qa/citations/verify', {
      documentId,
      citationId,
    });
  }

  getAvailableDocuments(): Observable<IQaDocumentInfo[]> {
    return this.api.get<BackendDocumentsResponse>('/qa/documents').pipe(
      map((res: BackendDocumentsResponse) => res.documents || [])
    );
  }

  submitFeedback(traceId: string, feedback: 'THUMBS_UP' | 'THUMBS_DOWN', comments?: string): Observable<boolean> {
    return this.api.post<{ success: boolean }>(`/qa/traces/${traceId}/feedback`, {
      feedback,
      comments,
    }).pipe(
      map((res) => !!res.success)
    );
  }
}
