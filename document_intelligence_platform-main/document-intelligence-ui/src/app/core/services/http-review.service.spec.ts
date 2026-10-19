import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpReviewService } from './http-review.service';
import { ApiClient } from '../api/api-client';

describe('HttpReviewService', () => {
  let service: HttpReviewService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (path: string) => of([]),
      post: (path: string, body: any) => of({ success: true }),
    };

    service = new HttpReviewService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call /review/queue and map review tasks', async () => {
    const mockTasks = [
      {
        id: 'DOC-101',
        docId: 'DOC-101',
        documentTitle: 'Invoice 101.pdf',
        assignee: 'Alice Reviewer',
        slaHoursLeft: 10.5,
        status: 'Pending Review',
        priority: 'High',
        confidence: 82,
        pages: 3,
        submittedAt: '2026-10-12T08:00:00Z',
        type: 'Purchase Invoice',
      },
    ];

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/review/queue');
      return of(mockTasks);
    };

    service.getReviewQueue().subscribe((tasks) => {
      expect(tasks.length).toBe(1);
      expect(tasks[0].docId).toBe('DOC-101');
      expect(tasks[0].priority).toBe('High');
    });
  });

  it('should call /review/:id for workbench data', async () => {
    const mockData = {
      documentId: 'DOC-101',
      documentTitle: 'Invoice 101.pdf',
      fields: [{ key: 'total_amount', value: '120.00' }],
    };

    apiClientSpy.get = (path: string) => {
      expect(path).toBe('/review/DOC-101');
      return of(mockData);
    };

    service.getReviewWorkbenchData('DOC-101').subscribe((data) => {
      expect(data.documentId).toBe('DOC-101');
      expect(data.fields.length).toBe(1);
    });
  });

  it('should call /review/:id/fields/:key for field corrections', async () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/review/DOC-101/fields/total_amount');
      expect(body.correctedValue).toBe('150.00');
      return of({ success: true });
    };

    service.correctField('DOC-101', 'total_amount', '150.00').subscribe((res) => {
      expect(res.success).toBe(true);
    });
  });

  it('should call /review/:id/decision on submitReview', async () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/review/DOC-101/decision');
      expect(body.action).toBe('APPROVE');
      return of({ success: true });
    };

    service.submitReview('DOC-101', { action: 'APPROVE', comments: 'Approved' }).subscribe((success) => {
      expect(success).toBe(true);
    });
  });
});
