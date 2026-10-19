import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { IDocumentService, IDocumentItem } from './api-services';

export interface BackendDocumentListItem {
  id?: string;
  documentId?: string;
  tenantId?: string;
  title?: string;
  name?: string;
  fileName?: string;
  docType?: string;
  documentType?: string;
  type?: string;
  category?: string;
  status?: string;
  owner?: string;
  confidence?: number;
  confidenceScore?: number;
  slaStatus?: string;
  source?: string;
  ingestionSource?: string;
  pages?: number;
  pageCount?: number;
  size?: string;
  fileSizeBytes?: number;
  uploadedAt?: string | Date;
  updatedAt?: string | Date;
  extractedMetadata?: string[];
}

export interface BackendDocumentListResponse {
  data: BackendDocumentListItem[];
  tenantId?: string;
  pagination?: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class HttpDocumentService implements IDocumentService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  getDocuments(filters?: any): Observable<IDocumentItem[]> {
    return this.api.get<BackendDocumentListResponse | BackendDocumentListItem[]>('/documents', filters).pipe(
      map((res) => {
        const items = Array.isArray(res) ? res : res?.data || [];
        return items.map((doc) => this.mapToDocumentItem(doc));
      }),
      catchError((err) => {
        console.warn('[HttpDocumentService] Failed to fetch documents from API:', err?.message || err);
        return of([]);
      })
    );
  }

  getDocumentById(id: string): Observable<IDocumentItem | null> {
    return this.api.get<{ data?: BackendDocumentListItem } | BackendDocumentListItem>(`/documents/${id}`).pipe(
      map((res) => {
        const doc: any = (res as any)?.data || res;
        if (!doc) return null;
        if (!doc.id && !doc.documentId) return null;
        return this.mapToDocumentItem(doc);
      }),
      catchError((err) => {
        console.warn(`[HttpDocumentService] Failed to fetch document ${id}:`, err?.message || err);
        return of(null);
      })
    );
  }

  /**
   * Enterprise Compliance: Arbitrary direct deletion of enterprise documents is prohibited (FR-015/016).
   * Deletion requests are routed to the compliant retention deletion cases workflow.
   */
  deleteDocument(id: string, reason: string = 'User requested deletion via document management'): Observable<boolean> {
    return this.api.post<any>('/retention/cases', { documentId: id, reason }).pipe(
      map(() => true),
      catchError((err) => {
        console.warn(`[HttpDocumentService] Compliant retention deletion request failed for ${id}:`, err?.message || err);
        return of(false);
      })
    );
  }

  /**
   * Uploads a document with client idempotency key and optional allowDuplicate flag (Part A.1/A.2)
   */
  uploadDocument(
    file: File,
    documentType: string = 'purchase-invoice',
    options?: { allowDuplicate?: boolean; idempotencyKey?: string }
  ): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (options?.allowDuplicate) {
      formData.append('allowDuplicate', 'true');
    }

    const idempotencyKey = options?.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const headers = new HttpHeaders({
      'Idempotency-Key': idempotencyKey,
    });

    return this.api.post<any>('/documents/upload', formData, headers);
  }

  /**
   * Fetches processing attempts timeline for a document (Part B.1)
   */
  getProcessingAttempts(id: string): Observable<any[]> {
    return this.api.get<any>(`/documents/${id}/attempts`).pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.attempts)) return res.attempts;
        return [];
      }),
      catchError((err) => {
        console.warn(`[HttpDocumentService] Failed to fetch attempts for ${id}:`, err);
        return of([]);
      })
    );
  }

  /**
   * Triggers manual retry for a FAILED document (Part B.1)
   */
  retryDocument(id: string, idempotencyKey?: string): Observable<any> {
    const key = idempotencyKey || `RETRY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const headers = new HttpHeaders({
      'Idempotency-Key': key,
    });
    return this.api.post<any>(`/documents/${id}/retry`, {}, headers);
  }

  /**
   * Fetches version history for a document (Part B.2)
   */
  getVersions(id: string): Observable<any[]> {
    return this.api.get<any>(`/documents/${id}/versions`).pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.versions)) return res.versions;
        return [];
      }),
      catchError((err) => {
        console.warn(`[HttpDocumentService] Failed to fetch versions for ${id}:`, err);
        return of([]);
      })
    );
  }

  /**
   * Replaces document file creating a new version and restarting review (Part B.2)
   */
  replaceDocument(id: string, file: File, idempotencyKey?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    const key = idempotencyKey || `REP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const headers = new HttpHeaders({
      'Idempotency-Key': key,
    });
    return this.api.post<any>(`/documents/${id}/replace`, formData, headers);
  }

  /**
   * Fetches latest grounded document summary (Part B.3)
   */
  getSummary(id: string): Observable<any> {
    return this.api.get<any>(`/documents/${id}/summary`).pipe(
      map((res) => res?.data || res),
      catchError((err) => {
        console.warn(`[HttpDocumentService] Failed to fetch summary for ${id}:`, err);
        return of(null);
      })
    );
  }

  /**
   * Generates grounded document summary with citation quotes (Part B.3)
   */
  generateSummary(id: string, idempotencyKey?: string): Observable<any> {
    const key = idempotencyKey || `SUM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const headers = new HttpHeaders({
      'Idempotency-Key': key,
    });
    return this.api.post<any>(`/documents/${id}/summary`, {}, headers);
  }

  /**
   * Updates grounded summary corrections (Part B.3)
   */
  updateSummary(id: string, summaryId: string, payload: { correctedSummaryText: string; correctionReason?: string }): Observable<any> {
    return this.api.put<any>(`/documents/${id}/summary/${summaryId}`, payload);
  }

  /**
   * URL for rendered page image (Part 0.3 / C.1)
   */
  getPageImageUrl(id: string, pageNo: number): string {
    return `/api/v1/documents/${id}/pages/${pageNo}/image`;
  }

  private mapToDocumentItem(doc: BackendDocumentListItem): IDocumentItem {
    const docId = doc.id || doc.documentId || '';
    const title = doc.name || doc.title || doc.fileName || `Document ${docId}`;
    const ownerName = doc.owner || 'System Ingest';
    const initials = ownerName
      .split(' ')
      .map((p) => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'SY';

    const docType = doc.type || doc.docType || doc.documentType || 'Supplier Contract';
    let category = doc.category;
    if (!category) {
      if (docType.toLowerCase().includes('invoice')) category = 'Invoice';
      else if (docType.toLowerCase().includes('policy')) category = 'Policy';
      else category = 'Contract';
    }

    let formattedSize = doc.size;
    if (!formattedSize && doc.fileSizeBytes) {
      formattedSize = doc.fileSizeBytes >= 1048576 
        ? `${(doc.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(doc.fileSizeBytes / 1024)} KB`;
    }

    let confidenceVal = 88;
    if (doc.confidence !== undefined) {
      confidenceVal = Math.round(doc.confidence * (doc.confidence <= 1 ? 100 : 1));
    } else if (doc.confidenceScore !== undefined) {
      confidenceVal = Math.round(doc.confidenceScore * (doc.confidenceScore <= 1 ? 100 : 1));
    }

    const dateVal = doc.updatedAt || doc.uploadedAt;
    const formattedDate = dateVal ? (typeof dateVal === 'string' ? dateVal : (dateVal as Date).toLocaleDateString()) : 'Today';

    return {
      id: docId,
      name: title,
      type: docType,
      category,
      status: doc.status || 'Approved',
      owner: ownerName,
      ownerInitials: initials,
      updatedAt: formattedDate,
      size: formattedSize || '1.8 MB',
      pages: doc.pages ?? doc.pageCount ?? 1,
      confidence: confidenceVal,
      extractedMetadata: doc.extractedMetadata || [`ID: ${docId}`],
      slaStatus: doc.slaStatus || 'ON_TRACK',
    };
  }
}
