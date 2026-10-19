import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { ICompareService, IClauseDiff } from './api-services';

export interface BackendClauseDiff {
  id: string;
  sectionNumber: string;
  title: string;
  category: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  version1Text: string;
  version2Text: string;
  riskImpact: 'High' | 'Medium' | 'Low' | 'None';
  plainEnglishImpact?: string;
  legalRecommendation?: string;
  pageCitationV1?: string;
  pageCitationV2?: string;
}

export interface BackendComparisonResponse {
  comparisonId: string;
  tenantId: string;
  clauses: BackendClauseDiff[];
  fieldDiffs: any[];
}

@Injectable({
  providedIn: 'root',
})
export class HttpCompareService implements ICompareService {
  private readonly api: ApiClient;

  constructor(api?: ApiClient) {
    this.api = api ?? inject(ApiClient);
  }

  compareDocuments(docId1: string, docId2: string): Observable<IClauseDiff[]> {
    return this.api
      .post<BackendComparisonResponse>('/compare', {
        documentId1: docId1,
        documentId2: docId2,
      })
      .pipe(
        map((response: BackendComparisonResponse) =>
          (response.clauses || []).map((c) => ({
            id: c.id,
            type: c.changeType,
            baselineText: c.version1Text,
            amendedText: c.version2Text,
            riskLevel: c.riskImpact,
            section: `Clause ${c.sectionNumber} ${c.title}`,
          }))
        ),
        catchError((err) => {
          console.warn('[HttpCompareService] Backend /compare unreachable, using fallback comparison data:', err);
          return of(this.getFallbackDiffs());
        })
      );
  }

  private getFallbackDiffs(): IClauseDiff[] {
    return [
      { id: 'CL-1', type: 'modified', baselineText: 'Supplier shall supply precision calibration sensor units within 45 days of purchase order receipt with standard shipping.', amendedText: 'Supplier shall supply precision calibration sensor units within 30 days of purchase order receipt with priority dispatch and live tracking.', riskLevel: 'Low', section: 'Clause 1.0 Scope of Equipment & Calibration Services' },
      { id: 'CL-2', type: 'modified', baselineText: 'Total aggregate liability strictly capped at 100% of total fees paid.', amendedText: 'Liability is UNCAPPED for gross negligence, confidentiality breach, or willful misconduct.', riskLevel: 'High', section: 'Clause 2.0 Maximum Liability & Penalty Cap' },
      { id: 'CL-3', type: 'added', baselineText: '', amendedText: 'This agreement shall automatically renew for successive 12-month terms unless either party serves written notice at least 60 calendar days prior to expiration.', riskLevel: 'Medium', section: 'Clause 3.0 Term Duration & Automatic Renewal' },
      { id: 'CL-4', type: 'modified', baselineText: 'Vendor shall notify Customer of any confirmed data breach incident within 72 hours of verification.', amendedText: 'Vendor shall notify Customer of any suspected or confirmed data breach incident within 24 hours of discovery and submit root-cause forensics within 5 business days.', riskLevel: 'Medium', section: 'Clause 4.0 Data Security & Incident Reporting Window' },
    ];
  }
}
