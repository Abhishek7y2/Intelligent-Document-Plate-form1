import { RetentionService } from './retention.service.js';

describe('RetentionService (DocuNexa Sprint 12 — Tasks 92–99)', () => {
  const TENANT_A = 'TNT-ALPHA';
  const TENANT_B = 'TNT-BETA';
  const USER_REQUESTER = 'USR-ANALYST-01';
  const USER_APPROVER = 'USR-COMPLIANCE-LEAD';
  const USER_LEGAL = 'USR-GENERAL-COUNSEL';

  beforeEach(() => {
    RetentionService.clearMemoryState();
  });

  // =========================================================================
  // TASK 92: VERSIONED RETENTION POLICIES
  // =========================================================================
  describe('Task 92: Retention Policies', () => {
    it('seeds and returns default compliance retention classes for a tenant', async () => {
      const policies = await RetentionService.listRetentionPolicies(TENANT_A);
      expect(policies.length).toBeGreaterThanOrEqual(4);
      const invoicePolicy = policies.find((p) => p.documentType === 'Purchase Invoice');
      expect(invoicePolicy).toBeDefined();
      expect(invoicePolicy?.retentionPeriodYears).toBe(7);
      expect(invoicePolicy?.actionAfterExpiry).toBe('purge');
    });

    it('upserts a custom versioned retention policy', async () => {
      const custom = await RetentionService.upsertRetentionPolicy(TENANT_A, USER_APPROVER, {
        documentType: 'Non-Disclosure Agreement',
        retentionPeriodYears: 5,
        triggerEvent: 'expiration_date',
        actionAfterExpiry: 'review',
        version: 'v2.0',
      });

      expect(custom.id).toContain('NON-DISCLOSURE-AGREEMENT-v2.0');
      expect(custom.retentionPeriodYears).toBe(5);
      expect(custom.version).toBe('v2.0');
      expect(custom.createdBy).toBe(USER_APPROVER);
    });

    it('rejects invalid retention periods under 1 year', async () => {
      await expect(
        RetentionService.upsertRetentionPolicy(TENANT_A, USER_APPROVER, {
          documentType: 'Invalid Doc',
          retentionPeriodYears: 0,
        })
      ).rejects.toThrow('Retention period must be at least 1 year.');
    });
  });

  // =========================================================================
  // TASK 93: DELETION CASES & SEPARATION OF DUTIES
  // =========================================================================
  describe('Task 93: Deletion Cases & SoD Enforcement', () => {
    it('submits a deletion case in REQUESTED status', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-1001',
        documentTitle: 'Invoice 2018 - Acme Corp',
        documentType: 'Purchase Invoice',
        legalBasis: 'RETENTION_EXPIRY',
      });

      expect(delCase.id).toMatch(/^DEL-/);
      expect(delCase.status).toBe('REQUESTED');
      expect(delCase.requestedBy).toBe(USER_REQUESTER);
      expect(delCase.holdCheckPassed).toBe(false);
      expect(delCase.evidence.binariesDeleted).toBe(false);
    });

    it('strictly enforces Separation of Duties (SoD): Requester cannot approve their own deletion case', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-1002',
        documentTitle: 'Vendor Contract 2016',
        documentType: 'Supplier Contract',
      });

      // Attempting self-approval by USER_REQUESTER must be blocked
      await expect(
        RetentionService.approveDeletionCase(TENANT_A, delCase.id, USER_REQUESTER)
      ).rejects.toThrow(/Separation of Duties violation/);
    });

    it('allows an authorized distinct approver to approve the deletion case', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-1003',
        documentTitle: 'Tax Return 2015',
        documentType: 'Tax Filing / W-9',
      });

      const approved = await RetentionService.approveDeletionCase(TENANT_A, delCase.id, USER_APPROVER);
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe(USER_APPROVER);
      expect(approved.approvedAt).toBeDefined();
    });

    it('enforces tenant isolation: Tenant B cannot approve Tenant A deletion case', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-1004',
        documentTitle: 'Tenant A Sensitive File',
        documentType: 'Supplier Contract',
      });

      await expect(
        RetentionService.approveDeletionCase(TENANT_B, delCase.id, USER_APPROVER)
      ).rejects.toThrow(/not found/);
    });
  });

  // =========================================================================
  // TASK 94: LEGAL HOLD INVARIANT ENFORCEMENT
  // =========================================================================
  describe('Task 94: Legal Hold Invariant Enforcement', () => {
    it('places an active legal hold on specific document IDs', async () => {
      const hold = await RetentionService.placeLegalHold(TENANT_A, USER_LEGAL, {
        matterName: 'SEC Inquiry 2026 - Vendor Audits',
        matterNumber: 'MAT-2026-0881',
        reason: 'Active litigation subpoena regarding 2024 vendor fees',
        scopeDocumentIds: ['DOC-HOLD-01', 'DOC-HOLD-02'],
      });

      expect(hold.id).toMatch(/^HOLD-/);
      expect(hold.status).toBe('ACTIVE');
      expect(hold.scopeDocumentIds).toContain('DOC-HOLD-01');

      const active = await RetentionService.getActiveHoldForDocument(TENANT_A, 'DOC-HOLD-01');
      expect(active).not.toBeNull();
      expect(active?.matterNumber).toBe('MAT-2026-0881');
    });

    it('CRITICAL INVARIANT: Active legal hold FREEZES purge execution immediately', async () => {
      // 1. Create and approve deletion case for document
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-LITIGATION-01',
        documentTitle: 'Audit Record 2017',
        documentType: 'Purchase Invoice',
      });
      await RetentionService.approveDeletionCase(TENANT_A, delCase.id, USER_APPROVER);

      // 2. Place an active legal hold on this document
      const hold = await RetentionService.placeLegalHold(TENANT_A, USER_LEGAL, {
        matterName: 'DOJ Antitrust Discovery',
        matterNumber: 'MAT-DOJ-9901',
        reason: 'Statutory hold order',
        scopeDocumentIds: ['DOC-LITIGATION-01'],
      });

      // 3. Attempt purge execution
      const result = await RetentionService.executePurge(TENANT_A, delCase.id);

      // Must be frozen/paused with hold failure
      expect(result.status).toBe('PAUSED_BY_LEGAL_HOLD');
      expect(result.holdCheckPassed).toBe(false);
      expect(result.activeHoldId).toBe(hold.id);
      expect(result.evidence.binariesDeleted).toBe(false);
      expect(result.evidence.ocrTextDeleted).toBe(false);

      // Verify audit ledger recorded the block
      const ledger = await RetentionService.listPurgeLedger(TENANT_A, delCase.id);
      const holdBlock = ledger.find((l) => l.status === 'BLOCKED_BY_HOLD');
      expect(holdBlock).toBeDefined();
      expect(holdBlock?.details.holdId).toBe(hold.id);
    });

    it('releases legal hold with audit reason and allows previously frozen purge to proceed', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-FROZEN-01',
        documentTitle: 'Closed Matter Contract',
        documentType: 'Supplier Contract',
      });
      await RetentionService.approveDeletionCase(TENANT_A, delCase.id, USER_APPROVER);

      const hold = await RetentionService.placeLegalHold(TENANT_A, USER_LEGAL, {
        matterName: 'Temporary Stay',
        matterNumber: 'MAT-STAY-01',
        reason: 'Injunction pending resolution',
        scopeDocumentIds: ['DOC-FROZEN-01'],
      });

      // Purge initially frozen
      const frozen = await RetentionService.executePurge(TENANT_A, delCase.id);
      expect(frozen.status).toBe('PAUSED_BY_LEGAL_HOLD');

      // Release hold
      const released = await RetentionService.releaseLegalHold(
        TENANT_A,
        hold.id,
        USER_LEGAL,
        'Matter concluded with final settlement and dismissed with prejudice'
      );
      expect(released?.status).toBe('RELEASED');
      expect(released?.releaseReason).toContain('final settlement');

      // Re-running purge now succeeds
      const completed = await RetentionService.executePurge(TENANT_A, delCase.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.holdCheckPassed).toBe(true);
      expect(completed.evidence.binariesDeleted).toBe(true);
      expect(completed.purgeSignatureHash).toBeDefined();
    });
  });

  // =========================================================================
  // TASKS 95–98: MULTI-STORE PURGE & RECOVERY
  // =========================================================================
  describe('Tasks 95–98: Multi-Store Purge Orchestration', () => {
    it('executes full multi-store purge across all 6 stores with cryptographic seal', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-EXPIRED-99',
        documentTitle: 'Old Tax Bill 2014',
        documentType: 'Tax Filing / W-9',
      });
      await RetentionService.approveDeletionCase(TENANT_A, delCase.id, USER_APPROVER);

      const result = await RetentionService.executePurge(TENANT_A, delCase.id);

      expect(result.status).toBe('COMPLETED');
      expect(result.holdCheckPassed).toBe(true);
      expect(result.completedAt).toBeDefined();

      // Check all required stores confirmed
      expect(result.evidence.binariesDeleted).toBe(true);
      expect(result.evidence.ocrTextDeleted).toBe(true);
      expect(result.evidence.extractionRecordsPurged).toBe(true);
      expect(result.evidence.vectorsSnippetsPurged).toBe(true);
      expect(result.evidence.cachesCleared).toBe(true);
      expect(result.evidence.exportsPurged).toBe(true);
      expect(result.evidence.backupsPurged).toBe(true);

      // Verify cryptographic SHA-256 seal
      expect(result.purgeSignatureHash).toMatch(/^[a-f0-9]{64}$/);

      // Verify audit ledger entry recorded
      const ledger = await RetentionService.listPurgeLedger(TENANT_A, delCase.id);
      const completedEntry = ledger.find((l) => l.operationType === 'PURGE_COMPLETED');
      expect(completedEntry).toBeDefined();
      expect(completedEntry?.sha256Seal).toBeDefined();
    });

    it('rejects purge execution on unapproved deletion cases', async () => {
      const delCase = await RetentionService.requestDeletionCase(TENANT_A, USER_REQUESTER, {
        documentId: 'DOC-DRAFT-01',
        documentTitle: 'Unapproved File',
        documentType: 'Purchase Invoice',
      });

      // Still in REQUESTED status
      await expect(RetentionService.executePurge(TENANT_A, delCase.id)).rejects.toThrow(
        /Must be APPROVED/
      );
    });
  });
});
