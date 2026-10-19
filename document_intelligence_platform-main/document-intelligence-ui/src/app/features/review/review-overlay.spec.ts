import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReviewWorkbench, BoundingBox } from './review-workbench/review-workbench';
import { REVIEW_SERVICE_TOKEN } from '../../core/services/api-services';
import { AuthService } from '../../core/services/auth.service';
import { of } from 'rxjs';

describe('Sprint 7 Review Bounding Box Overlay & Evidence Spec (Part 0.5)', () => {
  let component: ReviewWorkbench;
  let mockReviewService: any;
  let mockRoute: any;
  let mockRouter: any;
  let mockAuthService: any;

  beforeEach(() => {
    mockReviewService = {
      getReviewWorkbenchData: vi.fn().mockReturnValue(
        of({
          documentTitle: 'Invoice INV-2026-901',
          documentType: 'Purchase Invoice',
          pages: 3,
          fields: [
            {
              key: 'vendorName',
              label: 'Vendor Name',
              value: 'Apex Office Supplies',
              confidence: 96,
              boxes: [{ x: 0.12, y: 0.08, w: 0.25, h: 0.04 }],
              evidence_unmapped: false,
            },
            {
              key: 'paymentTerms',
              label: 'Payment Terms',
              value: 'Net 30 Days',
              confidence: 72,
              boxes: [],
              evidence_unmapped: true,
            },
          ],
          boundingBoxes: [
            {
              id: 'box-1',
              fieldKey: 'vendorName',
              label: 'Vendor Name',
              page: 1,
              top: 0.08,
              left: 0.12,
              width: 0.25,
              height: 0.04,
              value: 'Apex Office Supplies',
              confidence: 96,
            },
          ],
        })
      ),
      getReviewQueue: vi.fn().mockReturnValue(of([])),
    };

    mockRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('DOC-10248'),
        },
        queryParamMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ name: 'Test Reviewer', role: 'Admin' }),
      getCurrentUser: vi.fn().mockReturnValue({ name: 'Test Reviewer', role: 'Admin' }),
    };

    const injector = Injector.create({
      providers: [
        { provide: REVIEW_SERVICE_TOKEN, useValue: mockReviewService },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    component = runInInjectionContext(injector, () => new ReviewWorkbench());
  });

  describe('1. Bounding Box Overlay Scaling & Click Mapping', () => {
    it('scales normalized 0..1 coordinates into rendered percentages (0..100%)', () => {
      component.loadWorkbenchData();

      expect(component.boundingBoxes.length).toBe(1);
      const box = component.boundingBoxes[0];

      // Normalized 0.08 top scaled to 8%, 0.12 left scaled to 12%
      expect(box.top).toBe(8);
      expect(box.left).toBe(12);
      expect(box.width).toBe(25);
      expect(box.height).toBe(4);
    });

    it('maps onBoxClick to selecting the corresponding field and focusing it', () => {
      component.loadWorkbenchData();

      const selectSpy = vi.spyOn(component, 'selectField');
      const box: BoundingBox = component.boundingBoxes[0];

      component.onBoxClick(box);

      expect(selectSpy).toHaveBeenCalledWith('vendorName');
      expect(component.activeFieldKey).toBe('vendorName');
      expect(component.isBoxActive('vendorName')).toBe(true);
    });

    it('handles custom user-drawn region click and scales to percentages', () => {
      component.isDrawingRegionMode = true;
      component.currentPage = 1;
      component.activeFieldKey = 'vendorName';

      const mockEvent = {
        currentTarget: {
          getBoundingClientRect: () => ({ left: 100, top: 100, width: 800, height: 1000 }),
        },
        clientX: 300,
        clientY: 400,
      } as any;

      component.onCanvasClick(mockEvent);

      expect(component.isDrawingRegionMode).toBe(false);
      const drawnBox = component.boundingBoxes.find((b) => b.isUserDrawn);
      expect(drawnBox).toBeDefined();
      expect(drawnBox?.page).toBe(1);
      // (300 - 100) / 800 * 100 = 25%
      expect(drawnBox?.left).toBe(25);
      // (400 - 100) / 1000 * 100 = 30%
      expect(drawnBox?.top).toBe(30);
    });
  });

  describe('2. Unmapped Evidence Indicator', () => {
    it('sets evidence_unmapped to true when bounding boxes array is empty', () => {
      component.loadWorkbenchData();

      const mappedField = component.fields.find((f) => f.key === 'vendorName');
      const unmappedField = component.fields.find((f) => f.key === 'paymentTerms');

      expect(mappedField?.evidence_unmapped).toBe(false);
      expect(unmappedField?.evidence_unmapped).toBe(true);
    });
  });
});
