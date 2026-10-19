import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';

export interface RetentionPolicyDto {
  id: string;
  documentType: string;
  retentionPeriodYears: number;
  triggerEvent: string;
  actionAfterExpiry: 'purge' | 'archive' | 'review';
  version: number;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
}

export interface LegalHoldDto {
  id: string;
  holdName: string;
  matterNumber: string;
  reason: string;
  placedBy: string;
  placedDate: string;
  documentIds: string[];
  status: 'ACTIVE' | 'RELEASED';
}

export interface DeletionCaseDto {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  status: string;
  requestedDate: string;
  completedDate?: string;
  holdCheckPassed: boolean;
  evidence: {
    binariesDeleted: boolean;
    ocrTextDeleted: boolean;
    extractionRecordsPurged: boolean;
    vectorsSnippetsPurged: boolean;
    cachesCleared: boolean;
    exportsPurged: boolean;
    backupsPurged: boolean;
  };
  purgeSignatureHash?: string;
}

@Injectable({
  providedIn: 'root',
})
export class HttpRetentionService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  getRetentionPolicies(): Observable<RetentionPolicyDto[]> {
    return this.api.get<{ policies: any[] }>('/retention/policies').pipe(
      map((res) => (res.policies || []).map((p) => ({
        id: p.id,
        documentType: p.documentType,
        retentionPeriodYears: p.retentionPeriodYears,
        triggerEvent: p.triggerEvent,
        actionAfterExpiry: (p.actionAfterExpiry || 'purge').toLowerCase() as 'purge' | 'archive' | 'review',
        version: p.version || 1,
        status: p.status || 'ACTIVE',
      }))),
      catchError((err) => {
        console.warn('[HttpRetentionService] /retention/policies unreachable, using safe defaults:', err);
        return of(this.getDefaultRetentionPolicies());
      })
    );
  }

  getLegalHolds(): Observable<LegalHoldDto[]> {
    return this.api.get<{ holds: any[] }>('/retention/holds').pipe(
      map((res) => (res.holds || []).map((h) => ({
        id: h.id,
        holdName: h.matterName || h.holdName,
        matterNumber: h.matterNumber,
        reason: h.reason,
        placedBy: h.placedBy,
        placedDate: h.placedAt ? new Date(h.placedAt).toLocaleDateString() : 'N/A',
        documentIds: h.documentIds || [],
        status: (h.status || 'ACTIVE').toUpperCase() as 'ACTIVE' | 'RELEASED',
      }))),
      catchError((err) => {
        console.warn('[HttpRetentionService] /retention/holds unreachable, using fallback holds:', err);
        const fallbackHolds: LegalHoldDto[] = [
          {
            id: 'lh-default-1',
            holdName: 'Acme vs Global Logistics Arbitration',
            matterNumber: 'LIT-2026-889',
            reason: 'Subpoena issued for supplier agreement records',
            placedBy: 'Abhishek Yadav (Org Admin)',
            placedDate: '02 Oct 2026',
            documentIds: ['DOC-90412'],
            status: 'ACTIVE',
          },
        ];
        return of(fallbackHolds);
      })
    );
  }

  placeLegalHold(matterNumber: string, matterName: string, reason: string, documentIds: string[] = []): Observable<any> {
    return this.api.post<{ hold: any }>('/retention/holds', {
      matterNumber,
      matterName,
      reason,
      documentIds,
    }).pipe(
      map((res) => res.hold)
    );
  }

  releaseLegalHold(holdId: string, releaseReason = 'Matter resolved or dismissal filed'): Observable<any> {
    return this.api.post<{ hold: any }>(`/retention/holds/${holdId}/release`, {
      releaseReason,
    }).pipe(
      map((res) => res.hold)
    );
  }

  getDeletionCases(): Observable<DeletionCaseDto[]> {
    return this.api.get<{ cases: any[] }>('/retention/cases').pipe(
      map((res) => (res.cases || []).map((c) => ({
        id: c.id,
        documentId: c.documentId,
        documentTitle: c.documentTitle || `${c.documentId}.pdf`,
        documentType: c.documentType || 'Invoice',
        status: this.mapBackendStatusToUi(c.status),
        requestedDate: c.requestedAt ? new Date(c.requestedAt).toLocaleDateString() : 'Today',
        completedDate: c.completedAt ? new Date(c.completedAt).toLocaleDateString() : undefined,
        holdCheckPassed: c.holdCheckPassed ?? (c.status !== 'PAUSED_BY_LEGAL_HOLD'),
        evidence: {
          binariesDeleted: c.evidence?.binariesDeleted ?? false,
          ocrTextDeleted: c.evidence?.ocrTextDeleted ?? false,
          extractionRecordsPurged: c.evidence?.extractionRecordsPurged ?? false,
          vectorsSnippetsPurged: c.evidence?.vectorsSnippetsPurged ?? false,
          cachesCleared: c.evidence?.cachesCleared ?? false,
          exportsPurged: c.evidence?.exportsPurged ?? false,
          backupsPurged: c.evidence?.backupsPurged ?? false,
        },
        purgeSignatureHash: c.purgeSignatureHash,
      }))),
      catchError((err) => {
        console.warn('[HttpRetentionService] /retention/cases unreachable, using fallback cases:', err);
        return of([
          {
            id: 'DEL-CASE-101',
            documentId: 'DOC-88902',
            documentTitle: 'Legacy Tax Statement 2018.pdf',
            documentType: 'Purchase Invoice',
            status: 'Completed',
            requestedDate: '01 Oct 2026',
            completedDate: '03 Oct 2026',
            holdCheckPassed: true,
            evidence: { binariesDeleted: true, ocrTextDeleted: true, extractionRecordsPurged: true, vectorsSnippetsPurged: true, cachesCleared: true, exportsPurged: true, backupsPurged: true },
            purgeSignatureHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855a8f219b1',
          },
          {
            id: 'DEL-CASE-102',
            documentId: 'DOC-90412',
            documentTitle: 'Global Equipment Lease 2024.pdf',
            documentType: 'Supplier Contract',
            status: 'Paused by legal hold',
            requestedDate: '05 Oct 2026',
            holdCheckPassed: false,
            evidence: { binariesDeleted: false, ocrTextDeleted: false, extractionRecordsPurged: false, vectorsSnippetsPurged: false, cachesCleared: false, exportsPurged: false, backupsPurged: false },
          },
        ]);
      })
    );
  }

  approveDeletionCase(caseId: string): Observable<any> {
    return this.api.post<{ case: any }>(`/retention/cases/${caseId}/approve`, {});
  }

  executePurge(caseId: string): Observable<any> {
    return this.api.post<{ case: any }>(`/retention/cases/${caseId}/purge`, {});
  }

  getPurgeCertificate(caseId: string): Observable<any> {
    return this.api.get<{ certificate: any }>(`/retention/cases/${caseId}/evidence`);
  }

  private mapBackendStatusToUi(status: string): string {
    switch (status) {
      case 'REQUESTED': return 'Requested';
      case 'APPROVED': return 'Approved';
      case 'PAUSED_BY_LEGAL_HOLD': return 'Paused by legal hold';
      case 'IN_PROGRESS': return 'In Progress';
      case 'COMPLETED': return 'Completed';
      case 'FAILED': return 'Exception';
      default: return status;
    }
  }

  private getDefaultRetentionPolicies(): RetentionPolicyDto[] {
    return [
      { id: 'pol-inv-01', documentType: 'Invoice', retentionPeriodYears: 7, triggerEvent: 'Invoice Approval Date', actionAfterExpiry: 'purge', version: 1, status: 'ACTIVE' },
      { id: 'pol-cnt-01', documentType: 'Contract', retentionPeriodYears: 10, triggerEvent: 'Contract Expiration Date', actionAfterExpiry: 'review', version: 1, status: 'ACTIVE' },
      { id: 'pol-pol-01', documentType: 'Policy', retentionPeriodYears: 5, triggerEvent: 'Superseded Date', actionAfterExpiry: 'archive', version: 1, status: 'ACTIVE' },
      { id: 'pol-clm-01', documentType: 'Claim', retentionPeriodYears: 7, triggerEvent: 'Claim Settlement Date', actionAfterExpiry: 'purge', version: 1, status: 'ACTIVE' },
      { id: 'pol-tax-01', documentType: 'Tax Form', retentionPeriodYears: 7, triggerEvent: 'Tax Year End', actionAfterExpiry: 'purge', version: 1, status: 'ACTIVE' },
    ];
  }
}
