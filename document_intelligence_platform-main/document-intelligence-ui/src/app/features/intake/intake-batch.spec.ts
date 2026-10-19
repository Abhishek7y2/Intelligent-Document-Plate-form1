import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Intake, BatchQueueItem } from './intake';
import { DOCUMENT_SERVICE_TOKEN } from '../../core/services/api-services';
import { AuthService } from '../../core/services/auth.service';
import { of } from 'rxjs';

describe('Sprint 7 Intake Batch Upload & Duplicate Dialog Spec (Part 0.5)', () => {
  let component: Intake;
  let mockDocService: any;
  let mockAuthService: any;
  let mockRoute: any;

  beforeEach(() => {
    mockDocService = {
      getDocuments: vi.fn().mockReturnValue(of([])),
      uploadDocument: vi.fn().mockReturnValue(of({ data: { documentId: 'DOC-NEW-1' } })),
    };
    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ name: 'Test User', avatarInitials: 'TU' }),
    };
    mockRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    };

    const injector = Injector.create({
      providers: [
        { provide: DOCUMENT_SERVICE_TOKEN, useValue: mockDocService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    component = runInInjectionContext(injector, () => new Intake());
    (component as any).computeSHA256 = vi.fn().mockResolvedValue('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  describe('1. Batch Upload State Machine & Concurrency 3 Limit', () => {
    it('validates supported extensions and rejects unsupported files', () => {
      const validFile = new File(['valid pdf content'], 'invoice.pdf', { type: 'application/pdf' });
      const invalidFile = new File(['executable content'], 'malware.exe', { type: 'application/x-msdownload' });

      const validResult = component.validateFile(validFile);
      expect(validResult.valid).toBe(true);
      expect(validResult.extension).toBe('.pdf');

      const invalidResult = component.validateFile(invalidFile);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.reason).toContain('Unsupported file extension');
    });

    it('enforces maximum concurrency of 3 active uploads', () => {
      // Create 5 queued items
      const items: BatchQueueItem[] = Array.from({ length: 5 }, (_, idx) => ({
        id: `QUE-${idx + 1}`,
        file: new File([`content ${idx}`], `doc-${idx}.pdf`, { type: 'application/pdf' }),
        name: `doc-${idx}.pdf`,
        size: 1024,
        formattedSize: '1.0 KB',
        mimeType: 'application/pdf',
        extension: '.pdf',
        category: 'Invoices',
        checksumProgress: 0,
        checksum: 'pending',
        uploadProgress: 0,
        status: 'Queued',
        scanStatus: 'Pending',
        source: 'Web',
        uploadedAt: 'Just now',
        submitter: 'Test User',
        submitterInitials: 'TU',
        confidence: 0,
        attemptHistory: [],
      }));

      component.batchQueue = items;

      // Spy on startItemProcessing
      const startSpy = vi.spyOn(component as any, 'startItemProcessing').mockImplementation((item: any) => {
        item.status = 'Uploading';
      });

      (component as any).processBatchQueue();

      // Only first 3 items should have transitioned to Uploading
      expect(startSpy).toHaveBeenCalledTimes(3);
      expect(component.batchQueue[0].status).toBe('Uploading');
      expect(component.batchQueue[1].status).toBe('Uploading');
      expect(component.batchQueue[2].status).toBe('Uploading');
      expect(component.batchQueue[3].status).toBe('Queued');
      expect(component.batchQueue[4].status).toBe('Queued');
    });

    it('retries failed items resetting state and updating idempotency key', () => {
      const failedItem: BatchQueueItem = {
        id: 'QUE-FAIL-1',
        name: 'test.pdf',
        size: 2048,
        formattedSize: '2.0 KB',
        mimeType: 'application/pdf',
        extension: '.pdf',
        category: 'Invoices',
        checksumProgress: 100,
        checksum: 'hash123',
        uploadProgress: 100,
        status: 'Failed',
        scanStatus: 'Pending',
        source: 'Web',
        uploadedAt: '10 min ago',
        submitter: 'Test User',
        submitterInitials: 'TU',
        confidence: 0,
        errorReason: 'Network connection timeout',
        attemptHistory: [],
      };

      component.batchQueue = [failedItem];
      const processSpy = vi.spyOn(component as any, 'processBatchQueue').mockImplementation(() => {});

      component.retryItem(failedItem);

      expect(failedItem.status).toBe('Queued');
      expect(failedItem.uploadProgress).toBe(0);
      expect(failedItem.errorReason).toBeUndefined();
      expect(failedItem.idempotencyKey).toContain('IDEM-RETRY-');
      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('2. Duplicate Collision Dialog Modal', () => {
    it('triggers duplicate modal on 409 conflict and sets collision details', () => {
      const item: BatchQueueItem = {
        id: 'QUE-DUP-1',
        name: 'duplicate_invoice.pdf',
        size: 4096,
        formattedSize: '4.0 KB',
        mimeType: 'application/pdf',
        extension: '.pdf',
        category: 'Invoices',
        checksumProgress: 100,
        checksum: 'sha256_existing_hash',
        uploadProgress: 100,
        status: 'Duplicate',
        scanStatus: 'Clean',
        source: 'Web',
        uploadedAt: 'Just now',
        submitter: 'Test User',
        submitterInitials: 'TU',
        confidence: 0,
        attemptHistory: [],
      };

      component.triggerDuplicateWarning(item, 'DOC-EXISTING-99');

      expect(component.showDuplicateModal).toBe(true);
      expect(component.duplicateQueueItem).toBe(item);
      expect(component.existingDuplicateDoc?.id).toBe('DOC-EXISTING-99');
      expect(component.existingDuplicateDoc?.checksum).toBe('sha256_existing_hash');
    });

    it('resolves duplicate by allowing duplicate and re-enqueuing with allowDuplicate=true', () => {
      const item: BatchQueueItem = {
        id: 'QUE-DUP-1',
        name: 'duplicate_invoice.pdf',
        size: 4096,
        formattedSize: '4.0 KB',
        mimeType: 'application/pdf',
        extension: '.pdf',
        category: 'Invoices',
        checksumProgress: 100,
        checksum: 'sha256_existing_hash',
        uploadProgress: 100,
        status: 'Duplicate',
        scanStatus: 'Clean',
        source: 'Web',
        uploadedAt: 'Just now',
        submitter: 'Test User',
        submitterInitials: 'TU',
        confidence: 0,
        attemptHistory: [],
      };

      component.duplicateQueueItem = item;
      component.showDuplicateModal = true;
      const processSpy = vi.spyOn(component as any, 'processBatchQueue').mockImplementation(() => {});

      component.resolveDuplicateChoice('upload_anyway');

      expect(item.allowDuplicate).toBe(true);
      expect(item.status).toBe('Queued');
      expect(item.uploadProgress).toBe(0);
      expect(component.showDuplicateModal).toBe(false);
      expect(processSpy).toHaveBeenCalled();
    });

    it('cancels duplicate upload when user selects cancel', () => {
      const item: BatchQueueItem = {
        id: 'QUE-DUP-2',
        name: 'cancel_me.pdf',
        size: 1024,
        formattedSize: '1.0 KB',
        mimeType: 'application/pdf',
        extension: '.pdf',
        category: 'Invoices',
        checksumProgress: 100,
        checksum: 'sha256_cancel',
        uploadProgress: 100,
        status: 'Duplicate',
        scanStatus: 'Clean',
        source: 'Web',
        uploadedAt: 'Just now',
        submitter: 'Test User',
        submitterInitials: 'TU',
        confidence: 0,
        attemptHistory: [],
      };

      component.duplicateQueueItem = item;
      component.showDuplicateModal = true;

      component.resolveDuplicateChoice('cancel');

      expect(item.status).toBe('Failed');
      expect(item.errorReason).toContain('canceled by user');
      expect(component.showDuplicateModal).toBe(false);
    });
  });
});
