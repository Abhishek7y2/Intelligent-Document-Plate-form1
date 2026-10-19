import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpCompareService, BackendComparisonResponse } from './http-compare.service';
import { ApiClient } from '../api/api-client';

describe('HttpCompareService (Sprint 9 Angular Integration)', () => {
  let service: HttpCompareService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      post: (_path: string, _body: any) => of({ comparisonId: '', tenantId: '', clauses: [], fieldDiffs: [] }),
    };

    service = new HttpCompareService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call /compare API and map backend clauses to IClauseDiff array', () => {
    const mockBackendResponse: BackendComparisonResponse = {
      comparisonId: 'CMP-1029',
      tenantId: 'TNT-CORP-01',
      clauses: [
        {
          id: 'CL-2',
          sectionNumber: '2.0',
          title: 'Liability & Damage Limitation Cap',
          category: 'commercial',
          changeType: 'modified',
          version1Text: 'Total aggregate liability capped strictly at 100%.',
          version2Text: 'Total aggregate liability uncapped for gross negligence.',
          riskImpact: 'High',
        },
        {
          id: 'CL-3',
          sectionNumber: '3.0',
          title: 'Auto-Renewal Notice',
          category: 'compliance',
          changeType: 'added',
          version1Text: '',
          version2Text: 'Automatically renews for successive 12-month terms.',
          riskImpact: 'Medium',
        },
      ],
      fieldDiffs: [],
    };

    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/compare');
      expect(body.documentId1).toBe('DOC-10245-v1');
      expect(body.documentId2).toBe('DOC-10245-v2');
      return of(mockBackendResponse);
    };

    service.compareDocuments('DOC-10245-v1', 'DOC-10245-v2').subscribe((diffs) => {
      expect(diffs.length).toBe(2);
      expect(diffs[0]?.id).toBe('CL-2');
      expect(diffs[0]?.type).toBe('modified');
      expect(diffs[0]?.riskLevel).toBe('High');
      expect(diffs[0]?.section).toBe('Clause 2.0 Liability & Damage Limitation Cap');
      expect(diffs[1]?.type).toBe('added');
      expect(diffs[1]?.riskLevel).toBe('Medium');
    });
  });
});
