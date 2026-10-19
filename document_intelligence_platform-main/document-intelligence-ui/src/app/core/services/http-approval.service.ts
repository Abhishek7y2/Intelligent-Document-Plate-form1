import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { IApprovalService, IApprovalItem } from './api-services';

export interface BackendApprovalQueueItem {
  id: string;
  documentId: string;
  tenantId: string;
  documentTitle: string;
  documentType: string;
  tier: string;
  amount: number | null;
  currency: string;
  submittedBy: string;
  reviewedBy?: string;
  status: string;
  requiredApprovals: number;
  approvedCount: number;
  priority: 'High' | 'Medium' | 'Low';
  submittedAt: string;
  sourceVersion: string;
}

@Injectable({
  providedIn: 'root',
})
export class HttpApprovalService implements IApprovalService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  getApprovals(): Observable<IApprovalItem[]> {
    return this.api.get<BackendApprovalQueueItem[]>('/approvals/queue').pipe(
      map((items: BackendApprovalQueueItem[]) =>
        items.map((item) => ({
          id: item.id,
          docId: item.documentId,
          documentTitle: item.documentTitle,
          amount: item.amount ?? 0,
          uploader: item.submittedBy,
          currentStage: item.approvedCount + 1,
          totalStages: item.requiredApprovals,
          status: (item.status === 'APPROVED'
            ? 'Approved'
            : item.status === 'REJECTED'
            ? 'Rejected'
            : 'Pending') as 'Pending' | 'Approved' | 'Rejected',
        }))
      )
    );
  }

  approveDocument(id: string, comment?: string): Observable<boolean> {
    return this.api
      .post<{ request: any; isFullyApproved: boolean }>(`/approvals/${id}/decide`, {
        action: 'APPROVE',
        reasonCode: 'Verified & Compliant',
        comments: comment || 'Verified and approved',
      })
      .pipe(map(() => true));
  }

  rejectDocument(id: string, reason: string): Observable<boolean> {
    return this.api
      .post<{ request: any }>(`/approvals/${id}/decide`, {
        action: 'REJECT',
        reasonCode: reason,
        comments: reason,
      })
      .pipe(map(() => true));
  }

  getApprovalDetails(id: string): Observable<any> {
    return this.api.get<any>(`/approvals/${id}`);
  }

  publishToErp(id: string): Observable<any> {
    return this.api.post<any>(`/erp/publish/${id}`, {});
  }
}
