import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpRetentionService } from './http-retention.service';
import { ApiClient } from '../api/api-client';

describe('HttpRetentionService (DocuNexa Sprint 12 Angular Integration)', () => {
  let service: HttpRetentionService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (_path: string, _params?: any) => of({}),
      post: (_path: string, _body?: any) => of({}),
    };
    service = new HttpRetentionService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch retention policies from /retention/policies and map DTOs', () => {
    const mockBackendPolicies = {
      policies: [
        {
          id: 'pol-1',
          documentType: 'Invoice',
          retentionPeriodYears: 7,
          triggerEvent: 'Approval Date',
          actionAfterExpiry: 'PURGE',
          version: 1,
          status: 'ACTIVE',
        },
      ],
    };

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/retention/policies');
      return of(mockBackendPolicies);
    };

    let policies: any[] = [];
    service.getRetentionPolicies().subscribe((res) => {
      policies = res;
    });

    expect(policies.length).toBe(1);
    expect(policies[0].documentType).toBe('Invoice');
    expect(policies[0].retentionPeriodYears).toBe(7);
    expect(policies[0].actionAfterExpiry).toBe('purge');
  });

  it('should fetch active legal holds from /retention/legal-holds', () => {
    const mockBackendHolds = {
      holds: [
        {
          id: 'hold-123',
          matterName: 'Acme vs Global Logistics',
          matterNumber: 'LIT-2026-889',
          reason: 'Litigation freeze',
          placedBy: 'Legal Admin',
          placedAt: '2026-10-12T10:00:00Z',
          documentIds: ['DOC-101'],
          status: 'ACTIVE',
        },
      ],
    };

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/retention/holds');
      return of(mockBackendHolds);
    };

    let holds: any[] = [];
    service.getLegalHolds().subscribe((res) => {
      holds = res;
    });

    expect(holds.length).toBe(1);
    expect(holds[0].matterNumber).toBe('LIT-2026-889');
    expect(holds[0].status).toBe('ACTIVE');
  }, 15000);

  it('should place a legal hold via POST /retention/holds', () => {
    let capturedBody: any;
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/retention/holds');
      capturedBody = body;
      return of({
        hold: {
          id: 'hold-new-1',
          matterNumber: body.matterNumber,
          status: 'ACTIVE',
        },
      });
    };

    let created: any;
    service.placeLegalHold('LIT-2026-999', 'Regulatory Audit', 'FINRA 4511 compliance', ['DOC-202']).subscribe((res) => {
      created = res;
    });

    expect(capturedBody.matterNumber).toBe('LIT-2026-999');
    expect(capturedBody.documentIds).toContain('DOC-202');
    expect(created.id).toBe('hold-new-1');
  });

  it('should release a legal hold via POST /retention/holds/:id/release', () => {
    let capturedPath = '';
    let capturedBody: any;
    apiClientSpy.post = (path: string, body: any) => {
      capturedPath = path;
      capturedBody = body;
      return of({
        hold: {
          id: 'hold-123',
          status: 'RELEASED',
        },
      });
    };

    let result: any;
    service.releaseLegalHold('hold-123', 'Dismissal granted').subscribe((res) => {
      result = res;
    });

    expect(capturedPath).toBe('/retention/holds/hold-123/release');
    expect(capturedBody.releaseReason).toBe('Dismissal granted');
    expect(result.status).toBe('RELEASED');
  });

  it('should execute purge and return deletion case via POST /retention/cases/:id/purge', () => {
    let capturedPath = '';
    apiClientSpy.post = (path: string) => {
      capturedPath = path;
      return of({
        case: {
          id: 'del-case-1',
          status: 'COMPLETED',
          purgeSignatureHash: 'sha256_audit_seal_verified',
        },
      });
    };

    let result: any;
    service.executePurge('del-case-1').subscribe((res) => {
      result = res;
    });

    expect(capturedPath).toBe('/retention/cases/del-case-1/purge');
    expect(result.case.purgeSignatureHash).toBe('sha256_audit_seal_verified');
  });
});
