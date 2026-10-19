import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpApprovalService } from './http-approval.service';
import { ApiClient } from '../api/api-client';

describe('HttpApprovalService (Sprint 8 Angular Integration)', () => {
  let service: HttpApprovalService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (path: string) => of([]),
      post: (path: string, body: any) => of({ success: true }),
    };

    service = new HttpApprovalService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch approval queue and map to IApprovalItem array', async () => {
    const mockQueue = [
      {
        id: 'APP-101',
        documentId: 'DOC-10248',
        tenantId: 'TENANT-ALPHA',
        documentTitle: 'Invoice INV-902',
        documentType: 'purchase-invoice',
        tier: 'TIER_2',
        amount: 25000,
        currency: 'USD',
        submittedBy: 'Rahul Sharma',
        reviewedBy: 'Abhishek Yadav',
        status: 'PENDING',
        requiredApprovals: 2,
        approvedCount: 0,
        priority: 'Medium',
        submittedAt: '2026-10-12T08:00:00Z',
        sourceVersion: 'v1.0',
      },
    ];

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/approvals/queue');
      return of(mockQueue);
    };

    service.getApprovals().subscribe((items) => {
      expect(items.length).toBe(1);
      expect(items[0].docId).toBe('DOC-10248');
      expect(items[0].amount).toBe(25000);
      expect(items[0].uploader).toBe('Rahul Sharma');
      expect(items[0].status).toBe('Pending');
      expect(items[0].currentStage).toBe(1);
      expect(items[0].totalStages).toBe(2);
    });
  });

  it('should submit approve decision via POST /approvals/:id/decide', async () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/approvals/DOC-10248/decide');
      expect(body.action).toBe('APPROVE');
      expect(body.comments).toBe('Legal and Finance verified');
      return of({ success: true });
    };

    service.approveDocument('DOC-10248', 'Legal and Finance verified').subscribe((res) => {
      expect(res).toBe(true);
    });
  });

  it('should submit reject decision via POST /approvals/:id/decide', async () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/approvals/DOC-10248/decide');
      expect(body.action).toBe('REJECT');
      expect(body.reasonCode).toBe('Arithmetic Discrepancy');
      return of({ success: true });
    };

    service.rejectDocument('DOC-10248', 'Arithmetic Discrepancy').subscribe((res) => {
      expect(res).toBe(true);
    });
  });

  it('should trigger ERP dispatch via POST /erp/publish/:id', async () => {
    apiClientSpy.post = (path: string) => {
      expect(path).toBe('/erp/publish/DOC-10248');
      return of({ success: true, status: 'PUBLISHED' });
    };

    service.publishToErp('DOC-10248').subscribe((res) => {
      expect(res.status).toBe('PUBLISHED');
    });
  });
});
