import { generateSync } from 'otplib';
import { InvitationService } from './invitation.service.js';
import { MfaService } from './mfa.service.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { IntakeService } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { RetentionService } from './retention.service.js';
import { OutboxService } from './outbox.service.js';
import { ReviewService } from './review.service.js';
import { ApprovalService } from './approval.service.js';
import { MemoryStorageService } from './storage.service.js';
import { MockMalwareScanner, EICAR_TEST_STRING } from './scanner.service.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { OcrService } from './ocr.service.js';
import { UserRecord } from '../models/auth.models.js';
import { dbPool } from '../database/postgres.client.js';

describe('Sprint 4: User Invitations, TOTP MFA, File Replacement & Versioning Suite', () => {
  const tenantA = 'TNT-ALPHA-01';
  const tenantB = 'TNT-BETA-02';
  const adminUserA: UserRecord = {
    user_id: 'USR-ADMIN-A',
    tenant_id: tenantA,
    email: 'admin@alpha.org',
    full_name: 'Alpha Admin',
    role: 'Admin',
    password_hash: 'dummyhash',
    is_active: true,
    created_at: new Date(),
  };
  const standardUserA: UserRecord = {
    user_id: 'USR-DEV-A',
    tenant_id: tenantA,
    email: 'dev@alpha.org',
    full_name: 'Alpha Developer',
    role: 'contributor',
    password_hash: 'dummyhash',
    is_active: true,
    created_at: new Date(),
  };

  const samplePdf = Buffer.from('%PDF-1.4\nTest Document Initial Version 1\n%%EOF');
  const samplePdfV2 = Buffer.from('%PDF-1.4\nTest Document Replaced Version 2 Different Content\n%%EOF');

  beforeEach(() => {
    // Mock external email dispatch for fast, deterministic, offline unit testing
    jest.spyOn(EmailService, 'sendInvitationEmail').mockResolvedValue({
      success: true,
      messageId: '<mock@docunexa.io>',
      mode: 'sandbox',
    });

    standardUserA.mfa_enabled = false;
    standardUserA.mfa_secret_enc = undefined;
    standardUserA.mfa_recovery_hashes = undefined;
    adminUserA.mfa_enabled = false;
    adminUserA.mfa_secret_enc = undefined;
    adminUserA.mfa_recovery_hashes = undefined;

    AuthService.clearInMemoryUsers();
    AuthService.updateInMemoryUser(adminUserA);
    AuthService.updateInMemoryUser(standardUserA);
    InvitationService.clearInMemory();
    IntakeService.clearInMemory();
    OutboxService.clearInMemory();
    ReviewService.clearInMemory();
    ApprovalService.inMemoryRequests.clear();
    ExtractionService.clearInMemory();
    RetentionService.clearMemoryState();

    IntakeService.setStorage(new MemoryStorageService());
    IntakeService.setScanner(new MockMalwareScanner('heuristic'));
    OcrService.setEngine(new SyntheticMockOcrAdapter('standard'));
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      await dbPool.end();
    } catch {}
  });

  // =========================================================================
  // PART A: USER INVITATIONS
  // =========================================================================
  describe('Part A: User Invitations', () => {
    it('1. invite happy path: Admin successfully invites a user with a canonical role', async () => {
      const result = await InvitationService.inviteUser({
        tenantId: tenantA,
        invitedBy: adminUserA.user_id,
        inviterRole: adminUserA.role,
        email: 'analyst.new@alpha.org',
        role: 'Analyst',
      });

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^INV-/);
      expect(result.email).toBe('analyst.new@alpha.org');
      expect(result.role).toBe('Analyst');
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes in hex = 64 hex chars
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 47 * 3600 * 1000);

      // Verify it appears in pending invitations list
      const pending = await InvitationService.listPendingInvitations(tenantA);
      expect(pending.some((inv) => inv.id === result.id)).toBe(true);
      expect(EmailService.sendInvitationEmail).toHaveBeenCalledWith(
        'analyst.new@alpha.org',
        expect.stringContaining(result.token),
        tenantA,
        'Analyst'
      );
    });

    it('2. non-Admin cannot invite: throws 403 Forbidden', async () => {
      await expect(
        InvitationService.inviteUser({
          tenantId: tenantA,
          invitedBy: standardUserA.user_id,
          inviterRole: standardUserA.role, // role = 'contributor'
          email: 'another@alpha.org',
          role: 'Reviewer',
        })
      ).rejects.toThrow(/Only tenant administrators can invite new users/);
    });

    it('3. invite does not leak across tenants: tenant A cannot see or revoke tenant B invitations', async () => {
      const adminB: UserRecord = {
        user_id: 'USR-ADMIN-B',
        tenant_id: tenantB,
        email: 'admin@beta.org',
        full_name: 'Beta Admin',
        role: 'Admin',
        password_hash: 'dummyhash',
        is_active: true,
        created_at: new Date(),
      };

      const inviteB = await InvitationService.inviteUser({
        tenantId: tenantB,
        invitedBy: adminB.user_id,
        inviterRole: adminB.role,
        email: 'user@beta.org',
        role: 'Auditor',
      });

      // Tenant A should see 0 pending invitations
      const listA = await InvitationService.listPendingInvitations(tenantA);
      expect(listA.find((inv) => inv.id === inviteB.id)).toBeUndefined();

      // Tenant A cannot revoke Tenant B invitation
      const revokedByTenantA = await InvitationService.revokeInvitation(inviteB.id, tenantA);
      expect(revokedByTenantA).toBe(false);

      // Tenant B can revoke its own invitation
      const revokedByTenantB = await InvitationService.revokeInvitation(inviteB.id, tenantB);
      expect(revokedByTenantB).toBe(true);
    });

    it('4. accept-invite creates user with correct role and marks token used', async () => {
      const invite = await InvitationService.inviteUser({
        tenantId: tenantA,
        invitedBy: adminUserA.user_id,
        inviterRole: adminUserA.role,
        email: 'auditor.join@alpha.org',
        role: 'Auditor',
      });

      const acceptRes = await InvitationService.acceptInvitation({
        token: invite.token,
        password: 'ValidPassword123!',
        fullName: 'New Auditor',
      });

      expect(acceptRes).toBeDefined();
      expect(acceptRes.user_id).toBeDefined();
      expect(acceptRes.role).toBe('Auditor');

      // Verify newly created user
      const createdUser = await AuthService.findUserByEmailAndTenant('auditor.join@alpha.org', tenantA);
      expect(createdUser).not.toBeNull();
      expect(createdUser?.role).toBe('Auditor');
      expect(createdUser?.full_name).toBe('New Auditor');
      expect(createdUser?.is_active).toBe(true);

      // Verify token cannot be reused
      await expect(
        InvitationService.acceptInvitation({
          token: invite.token,
          password: 'ValidPassword123!',
          fullName: 'New Auditor',
        })
      ).rejects.toThrow(/Invalid, expired, or revoked invitation token/);
    });

    it('5. expired/reused/revoked token returns generic 400', async () => {
      const invite = await InvitationService.inviteUser({
        tenantId: tenantA,
        invitedBy: adminUserA.user_id,
        inviterRole: adminUserA.role,
        email: 'revoked.user@alpha.org',
        role: 'Reviewer',
      });

      // Revoke the invitation
      await InvitationService.revokeInvitation(invite.id, tenantA);

      // Attempt accept
      await expect(
        InvitationService.acceptInvitation({
          token: invite.token,
          password: 'ValidPassword123!',
          fullName: 'Revoked Person',
        })
      ).rejects.toThrow(/Invalid, expired, or revoked invitation token/);
    });
  });

  // =========================================================================
  // PART B: TOTP MFA
  // =========================================================================
  describe('Part B: TOTP MFA Integration', () => {
    it('6. MFA enroll + verify + login with valid TOTP code', async () => {
      // 1. Enroll
      const enrollment = await MfaService.enroll(standardUserA);
      expect(enrollment.secret).toBeDefined();
      expect(enrollment.otpauthUrl).toContain('otpauth://totp/');
      expect(enrollment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

      // At this point, MFA is NOT enabled yet
      expect(standardUserA.mfa_enabled).toBe(false);

      // 2. Generate valid TOTP token using otplib generateSync
      const validCode = generateSync({ secret: enrollment.secret });

      // 3. Verify enrollment
      const verifyRes = await MfaService.verifyEnrollment(standardUserA, validCode);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.recoveryCodes).toHaveLength(8);
      expect(standardUserA.mfa_enabled).toBe(true);

      // 4. Login requires TOTP
      // Login attempt without code triggers mfaRequired
      const loginWithoutMfa = await AuthService.login(standardUserA.email, 'password123');
      expect((loginWithoutMfa as any).mfaRequired).toBe(true);

      // Login with valid TOTP code succeeds
      const currentCode = generateSync({ secret: enrollment.secret });
      const loginWithMfa = await AuthService.login(standardUserA.email, 'password123', currentCode);
      expect((loginWithMfa as any).accessToken).toBeDefined();
    });

    it('7. wrong code and recovery code reuse rejected', async () => {
      const enrollment = await MfaService.enroll(standardUserA);
      const validCode = generateSync({ secret: enrollment.secret });
      const verifyRes = await MfaService.verifyEnrollment(standardUserA, validCode);
      const recoveryCodes = verifyRes.recoveryCodes;

      // Login with wrong code fails
      await expect(AuthService.login(standardUserA.email, 'password123', '000000')).rejects.toThrow(
        /Invalid TOTP code or recovery code/
      );

      // Login with valid recovery code succeeds
      const firstRecovery = recoveryCodes[0];
      const loginRecovery = await AuthService.login(standardUserA.email, 'password123', firstRecovery);
      expect((loginRecovery as any).accessToken).toBeDefined();

      // Re-using the same recovery code is rejected
      await expect(AuthService.login(standardUserA.email, 'password123', firstRecovery)).rejects.toThrow(
        /Invalid TOTP code or recovery code/
      );
    });

    it('8. MFA disable requires current code and revokes all active sessions', async () => {
      const enrollment = await MfaService.enroll(standardUserA);
      const validCode = generateSync({ secret: enrollment.secret });
      await MfaService.verifyEnrollment(standardUserA, validCode);

      // Login to generate an active session
      const currentCode1 = generateSync({ secret: enrollment.secret });
      await AuthService.login(standardUserA.email, 'password123', currentCode1);

      const sessionsBefore = AuthService.getUserSessions(standardUserA.user_id);
      expect(sessionsBefore.length).toBeGreaterThan(0);
      expect(sessionsBefore.some((s) => !s.is_revoked)).toBe(true);

      // Attempt disable with wrong code fails
      await expect(MfaService.disableMfa(standardUserA, '999999')).rejects.toThrow(/Invalid TOTP verification code/);

      // Disable with current TOTP code
      const currentCode2 = generateSync({ secret: enrollment.secret });
      const disableRes = await MfaService.disableMfa(standardUserA, currentCode2);
      expect(disableRes.success).toBe(true);
      expect(standardUserA.mfa_enabled).toBe(false);

      // All sessions are revoked
      const sessionsAfter = AuthService.getUserSessions(standardUserA.user_id);
      expect(sessionsAfter.every((s) => s.is_revoked)).toBe(true);
    });
  });

  // =========================================================================
  // PART C: FILE REPLACEMENT & VERSIONING (FR-015)
  // =========================================================================
  describe('Part C: File Replacement & Versioning', () => {
    it('9. replace creates v2 and keeps v1 object intact in storage', async () => {
      // 1. Initial ingest creates document and version 1
      const initialUpload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdf,
        originalFilename: 'contract_v1.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      const initialDoc = await IntakeService.getDocument(initialUpload.documentId, tenantA);
      const v1StorageKey = initialDoc?.storagePath!;

      // Check version 1 exists
      const versionsBefore = await IntakeService.listDocumentVersions(initialUpload.documentId, tenantA);
      expect(versionsBefore).toHaveLength(1);
      expect(versionsBefore[0].versionNo).toBe(1);
      expect(versionsBefore[0].isCurrent).toBe(true);

      // 2. Replace document with v2
      const replaceResult = await IntakeService.replaceDocument({
        documentId: initialUpload.documentId,
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdfV2,
        originalFilename: 'contract_v2_updated.pdf',
        declaredMimeType: 'application/pdf',
      });

      expect(replaceResult.versionNo).toBe(2);
      expect(replaceResult.storageKey).not.toBe(v1StorageKey);

      // 3. Verify storage retains v1 object intact
      const storage = IntakeService.getStorage();
      const v1Buffer = await storage.getObject(v1StorageKey);
      expect(v1Buffer.toString()).toBe(samplePdf.toString());

      // 4. Verify v2 object is stored under new versioned key
      const v2Buffer = await storage.getObject(replaceResult.storageKey);
      expect(v2Buffer.toString()).toBe(samplePdfV2.toString());

      // 5. Verify versions list shows v2 as current and v1 as non-current
      const versionsAfter = await IntakeService.listDocumentVersions(initialUpload.documentId, tenantA);
      expect(versionsAfter).toHaveLength(2);
      const v1 = versionsAfter.find((v) => v.versionNo === 1);
      const v2 = versionsAfter.find((v) => v.versionNo === 2);
      expect(v1?.isCurrent).toBe(false);
      expect(v2?.isCurrent).toBe(true);
    });

    it('10. replace of infected file creates nothing (fail-closed ClamAV)', async () => {
      // Ingest clean document first
      const initialUpload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdf,
        originalFilename: 'clean_contract.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      const versionsBefore = await IntakeService.listDocumentVersions(initialUpload.documentId, tenantA);
      expect(versionsBefore).toHaveLength(1);

      // Attempt replace with EICAR infected buffer
      const infectedBuffer = Buffer.from(EICAR_TEST_STRING);

      await expect(
        IntakeService.replaceDocument({
          documentId: initialUpload.documentId,
          tenantId: tenantA,
          userId: adminUserA.user_id,
          buffer: infectedBuffer,
          originalFilename: 'malware.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow();

      // Verify no new version was created
      const versionsAfter = await IntakeService.listDocumentVersions(initialUpload.documentId, tenantA);
      expect(versionsAfter).toHaveLength(1);
      expect(versionsAfter[0].versionNo).toBe(1);
    });

    it('11. replace restarts review and supersedes old approvals and reviews', async () => {
      const initialUpload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdf,
        originalFilename: 'policy.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      // Simulate existing review item
      ReviewService.inMemoryTasks.set(`${tenantA}:${initialUpload.documentId}`, {
        id: 'REV-001',
        docId: initialUpload.documentId,
        documentId: initialUpload.documentId,
        tenantId: tenantA,
        documentTitle: 'policy.pdf',
        status: 'Pending Review' as any,
        priority: 'Medium' as any,
        reviewReason: 'Initial extraction review',
        assignedTo: 'USR-DEV-A',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      // Simulate existing approval request
      ApprovalService.inMemoryRequests.set(`${tenantA}:${initialUpload.documentId}`, {
        id: 'APR-001',
        documentId: initialUpload.documentId,
        tenantId: tenantA,
        status: 'PENDING',
        confidenceScore: 0.85,
        policyRulesMatched: ['Standard invoice check'],
        requestedBy: adminUserA.user_id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      // Replace document
      await IntakeService.replaceDocument({
        documentId: initialUpload.documentId,
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdfV2,
        originalFilename: 'policy_v2.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Check review item is SUPERSEDED
      const rev = ReviewService.inMemoryTasks.get(`${tenantA}:${initialUpload.documentId}`);
      expect(rev?.status).toBe('SUPERSEDED');

      // Check approval request is SUPERSEDED
      const apr = ApprovalService.inMemoryRequests.get(`${tenantA}:${initialUpload.documentId}`);
      expect(apr?.status).toBe('SUPERSEDED');

      // Check outbox recorded DOCUMENT_UPLOADED then DOCUMENT_REPLACED event
      const firstEvent = await OutboxService.claimNextEvent(tenantA);
      expect(firstEvent?.eventType).toBe('DOCUMENT_UPLOADED');
      const secondEvent = await OutboxService.claimNextEvent(tenantA);
      expect(secondEvent?.eventType).toBe('DOCUMENT_REPLACED');
    });

    it('12. extracted fields carry source_version_id', async () => {
      const initialUpload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdf,
        originalFilename: 'invoice.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      // Run OCR first so extraction prerequisite is satisfied
      await OcrService.processDocument(initialUpload.documentId, tenantA);

      // Perform extraction on document
      const extractionResult = await ExtractionService.extractDocument(initialUpload.documentId, tenantA);
      expect(extractionResult.fields.length).toBeGreaterThan(0);

      // Verify each field carries sourceVersionId corresponding to v1
      const versions = await IntakeService.listDocumentVersions(initialUpload.documentId, tenantA);
      const v1 = versions.find((v) => v.versionNo === 1);
      expect(v1).toBeDefined();

      for (const field of extractionResult.fields) {
        expect(field.sourceVersionId).toBe(v1?.id);
      }
    });

    it('13. cross-tenant replace returns 404', async () => {
      const uploadTenantA = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdf,
        originalFilename: 'invoice_tenant_a.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'purchase-invoice',
      });

      // Tenant B tries to replace Tenant A's document
      await expect(
        IntakeService.replaceDocument({
          documentId: uploadTenantA.documentId,
          tenantId: tenantB,
          userId: 'USR-DEV-B',
          buffer: samplePdfV2,
          originalFilename: 'invoice_tenant_b_replace.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(/not found within tenant/);
    });

    it('14. retention purge deletes all version objects and records each in purge ledger', async () => {
      const storage = IntakeService.getStorage();

      // Ingest v1
      const upload = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdf,
        originalFilename: 'doc_to_purge.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'Purchase Invoice',
      });

      const v1StorageKey = (await IntakeService.getDocument(upload.documentId, tenantA))?.storagePath!;

      // Replace with v2
      const replaceRes = await IntakeService.replaceDocument({
        documentId: upload.documentId,
        tenantId: tenantA,
        userId: adminUserA.user_id,
        buffer: samplePdfV2,
        originalFilename: 'doc_to_purge_v2.pdf',
        declaredMimeType: 'application/pdf',
      });

      const v2StorageKey = replaceRes.storageKey;

      // Verify both binaries exist before purge
      expect(await storage.hasObject(v1StorageKey)).toBe(true);
      expect(await storage.hasObject(v2StorageKey)).toBe(true);

      // Trigger purge via RetentionService deletion case workflow
      const deletionCase = await RetentionService.requestDeletionCase(
        tenantA,
        adminUserA.user_id,
        {
          documentId: upload.documentId,
          documentTitle: upload.fileName,
          documentType: upload.documentType,
          legalBasis: 'Legal retention period expired (7 years)',
        }
      );

      // Approver must be distinct compliance officer to satisfy Separation of Duties (SoD)
      await RetentionService.approveDeletionCase(tenantA, deletionCase.id, 'USR-COMPLIANCE-01');
      const completedCase = await RetentionService.executePurge(tenantA, deletionCase.id);
      expect(completedCase.status).toBe('COMPLETED');

      // Verify both binaries are physically removed from storage
      expect(await storage.hasObject(v1StorageKey)).toBe(false);
      expect(await storage.hasObject(v2StorageKey)).toBe(false);

      // Verify purge ledger contains records for both version deletions
      const ledger = await RetentionService.listPurgeLedger(tenantA, deletionCase.id);
      const versionEntries = ledger.filter((l) => l.storeTarget === 'PRIVATE_OBJECT_STORAGE_VERSION');
      expect(versionEntries.length).toBeGreaterThanOrEqual(2);

      const cleanV1 = v1StorageKey.replace(/^memory:\/\//, '');
      const cleanV2 = v2StorageKey.replace(/^memory:\/\//, '');
      expect(versionEntries.some((e) => e.details?.storageKey === v1StorageKey || e.details?.cleanKey === cleanV1)).toBe(true);
      expect(versionEntries.some((e) => e.details?.storageKey === v2StorageKey || e.details?.cleanKey === cleanV2)).toBe(true);
    });
  });
});
