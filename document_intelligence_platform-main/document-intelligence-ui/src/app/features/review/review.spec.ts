import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Review } from './review';
import { REVIEW_SERVICE_TOKEN } from '../../core/services/api-services';

describe('Review Component', () => {
  let component: Review;
  let mockReviewService: any;

  beforeEach(() => {
    mockReviewService = {
      getReviewQueue: () =>
        of([
          {
            id: 'DOC-10247',
            docId: 'DOC-10247',
            documentTitle: 'Purchase Invoice - INV-78421',
            assignee: 'Rahul Sharma',
            slaHoursLeft: 3.5,
            status: 'Pending Review',
            priority: 'High',
            confidence: 91,
            pages: 4,
            submittedAt: '04 Oct 2026',
            type: 'Purchase Invoice',
          },
          {
            id: 'DOC-10245',
            docId: 'DOC-10245',
            documentTitle: 'Vendor Agreement - Contoso',
            assignee: 'Priya Patel',
            slaHoursLeft: 8.0,
            status: 'In Progress',
            priority: 'Medium',
            confidence: 96,
            pages: 12,
            submittedAt: '05 Oct 2026',
            type: 'Supplier Contract',
          },
        ]),
    };

    const injector = Injector.create({
      providers: [{ provide: REVIEW_SERVICE_TOKEN, useValue: mockReviewService }],
    });

    component = runInInjectionContext(injector, () => new Review());
    component.ngOnInit();
  });

  it('should create the Review component', () => {
    expect(component).toBeTruthy();
  });

  it('should load review queue documents on init', () => {
    expect(component.reviewDocuments.length).toBe(2);
    expect(component.reviewDocuments[0].id).toBe('DOC-10247');
    expect(component.reviewDocuments[0].name).toBe('Purchase Invoice - INV-78421');
    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(false);
  });

  it('should filter documents by search term', () => {
    component.searchTerm = 'Vendor';
    expect(component.filteredDocuments.length).toBe(1);
    expect(component.filteredDocuments[0].id).toBe('DOC-10245');

    component.searchTerm = 'Nonexistent';
    expect(component.filteredDocuments.length).toBe(0);
  });

  it('should filter documents by document type', () => {
    component.selectedType = 'Purchase Invoice';
    expect(component.filteredDocuments.length).toBe(1);
    expect(component.filteredDocuments[0].type).toBe('Purchase Invoice');
  });

  it('should handle error when loading review queue fails', () => {
    mockReviewService.getReviewQueue = () => throwError(() => new Error('API Error'));
    component.loadReviewQueue();

    expect(component.hasError()).toBe(true);
    expect(component.isLoading()).toBe(false);
  });
});
