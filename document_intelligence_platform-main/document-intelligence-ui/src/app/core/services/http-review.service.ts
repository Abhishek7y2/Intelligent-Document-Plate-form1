import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { IReviewService, IReviewTask } from './api-services';

@Injectable({
  providedIn: 'root',
})
export class HttpReviewService implements IReviewService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  getReviewQueue(): Observable<IReviewTask[]> {
    return this.api.get<any[]>('/review/queue').pipe(
      map((tasks) =>
        tasks.map((t) => ({
          id: t.id || t.docId,
          docId: t.docId || t.id,
          documentTitle: t.documentTitle || t.name || 'Untitled Document',
          assignee: t.assignee || 'Unassigned',
          slaHoursLeft: t.slaHoursLeft ?? 12.0,
          status: t.status || 'Pending Review',
          priority: t.priority || 'Medium',
          confidence: t.confidence ?? 85,
          pages: t.pages ?? 1,
          submittedAt: t.submittedAt || 'Today',
          type: t.type || 'Purchase Invoice',
        }))
      )
    );
  }

  getReviewWorkbenchData(docId: string): Observable<any> {
    return this.api.get<any>(`/review/${docId}`);
  }

  correctField(docId: string, key: string, value: any, reason?: string): Observable<any> {
    return this.api.post<any>(`/review/${docId}/fields/${key}`, {
      correctedValue: value,
      reason: reason || 'Reviewer correction in Review Workbench',
    });
  }

  submitReview(taskId: string, payload: any): Observable<boolean> {
    let action = 'APPROVE';
    if (typeof payload === 'string') {
      action = payload.toUpperCase();
    } else if (payload?.action) {
      action = payload.action.toUpperCase();
    } else if (payload?.decision) {
      action = payload.decision.toUpperCase();
    }

    const comments = payload?.comments || payload?.comment || '';

    return this.api.post<any>(`/review/${taskId}/decision`, { action, comments }).pipe(
      map((res) => (res && res.success !== undefined ? res.success : true))
    );
  }

  getAuditLogs(docId: string): Observable<any[]> {
    return this.api.get<{ auditLogs: any[] }>(`/review/${docId}/audit`).pipe(
      map((res) => res?.auditLogs || [])
    );
  }
}
