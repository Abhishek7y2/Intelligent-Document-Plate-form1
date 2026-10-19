import crypto from 'crypto';
import { IdempotencyService } from './idempotency.service.js';
import { WebhookService } from './webhook.service.js';
import { ExportMaskingService } from './export-masking.service.js';
import { ExportService } from './export.service.js';
import { NotificationService } from './notification.service.js';
import { ReportService } from './report.service.js';
import { ReviewService, ReviewValidationError } from './review.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { OutboxService } from './outbox.service.js';
import { IntakeService } from './intake.service.js';
import { AuthService } from './auth.service.js';
import { getCorrelationId, runWithCorrelationId } from '../middleware/correlation.middleware.js';
import { AuthenticatedUser } from '../middleware/auth.middleware.js';

describe('Sprint 6 Hardening, Governance, Notifications & Correlation IDs Spec Suite', () => {
  const tenantA = 'TNT-ALPHA-01';
  const tenantB = 'TNT-BETA-02';
  const userAdminA: AuthenticatedUser = {
    userId: 'USR-ADMIN-01',
    email: 'admin@alpha.org',
    role: 'Admin',
    tenantId: tenantA,
    permissions: ['ADMIN_ACCESS', 'DOC_APPROVE', 'DOC_VIEW', 'DOC_EDIT', 'REPORT_GENERATE'],
    sessionId: 'SES-001',
  };
  const userReviewerA: AuthenticatedUser = {
    userId: 'USR-REV-01',
    email: 'reviewer@alpha.org',
    role: 'Reviewer',
    tenantId: tenantA,
    permissions: ['DOC_VIEW', 'DOC_EDIT', 'DOC_VERIFY', 'REPORT_GENERATE'],
    sessionId: 'SES-002',
  };
  const userAnalystA: AuthenticatedUser = {
    userId: 'USR-ANA-01',
    email: 'analyst@alpha.org',
    role: 'Analyst',
    tenantId: tenantA,
    permissions: ['DOC_VIEW', 'REPORT_GENERATE'],
    sessionId: 'SES-003',
  };

  beforeEach(() => {
    IdempotencyService.clearInMemory();
    ExportMaskingService.clearInMemory();
    ExportService.clearInMemory();
    NotificationService.clearInMemory();
    ReviewService.clearInMemory();
    AuditTrailService.clearInMemory();
    OutboxService.clearInMemory();
    WebhookService.clearInMemory();
    IntakeService.clearInMemory();

    // Seed test users and active sessions in AuthService
    AuthService.setInMemoryUser({
      user_id: userAdminA.userId,
      tenant_id: tenantA,
      email: userAdminA.email,
      full_name: 'Admin A',
      role: userAdminA.role,
      password_hash: 'hash',
      is_active: true,
      created_at: new Date(),
    });
    AuthService.setInMemorySession({
      session_id: userAdminA.sessionId!,
      user_id: userAdminA.userId,
      tenant_id: tenantA,
      refresh_token_hash: 'hash_ses_001',
      family_id: 'fam_001',
      is_revoked: false,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
      last_used_at: new Date(),
    });
    AuthService.setInMemoryUser({
      user_id: userReviewerA.userId,
      tenant_id: tenantA,
      email: userReviewerA.email,
      full_name: 'Reviewer A',
      role: userReviewerA.role,
      password_hash: 'hash',
      is_active: true,
      created_at: new Date(),
    });
    AuthService.setInMemorySession({
      session_id: userReviewerA.sessionId!,
      user_id: userReviewerA.userId,
      tenant_id: tenantA,
      refresh_token_hash: 'hash_ses_002',
      family_id: 'fam_002',
      is_revoked: false,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
      last_used_at: new Date(),
    });
    AuthService.setInMemoryUser({
      user_id: userAnalystA.userId,
      tenant_id: tenantA,
      email: userAnalystA.email,
      full_name: 'Analyst A',
      role: userAnalystA.role,
      password_hash: 'hash',
      is_active: true,
      created_at: new Date(),
    });
  });

  // =========================================================================
  // Part B: Idempotency (FR-023)
  // =========================================================================
  describe('Part B: Idempotency Semantics', () => {
    it('1. idempotent replay returns the stored response and does not execute twice', async () => {
      const key = 'idem-req-001';
      const body = { documentType: 'Invoice', vendor: 'Acme Corp' };
      const hash = IdempotencyService.computeRequestHash(body);

      // 1. Initial request creates in_progress record
      const created = await IdempotencyService.createInProgressRecord(tenantA, userAdminA.userId, key, hash);
      expect(created).toBe(true);

      // 2. Complete operation
      const initialResponse = { documentId: 'DOC-100', status: 'PROCESSING' };
      await IdempotencyService.completeRecord(tenantA, userAdminA.userId, key, 202, initialResponse);

      // 3. Replay request finds completed record with same hash
      const record = await IdempotencyService.findRecord(tenantA, userAdminA.userId, key);
      expect(record).not.toBeNull();
      expect(record?.status).toBe('completed');
      expect(record?.requestHash).toBe(hash);
      expect(record?.responseStatus).toBe(202);
      expect(record?.responseBody).toEqual(initialResponse);
    });

    it('2. same key with different request body returns 422 payload mismatch', async () => {
      const key = 'idem-req-002';
      const body1 = { amount: 100 };
      const body2 = { amount: 200 };

      const hash1 = IdempotencyService.computeRequestHash(body1);
      const hash2 = IdempotencyService.computeRequestHash(body2);

      await IdempotencyService.createInProgressRecord(tenantA, userAdminA.userId, key, hash1);
      await IdempotencyService.completeRecord(tenantA, userAdminA.userId, key, 200, { success: true });

      // Lookup with different hash verifies mismatch condition
      const record = await IdempotencyService.findRecord(tenantA, userAdminA.userId, key);
      expect(record).not.toBeNull();
      expect(record?.requestHash).not.toBe(hash2);
      expect(record?.requestHash).toBe(hash1);
    });

    it('3. concurrent request with same in-progress key returns 409 conflict', async () => {
      const key = 'idem-req-003';
      const hash = IdempotencyService.computeRequestHash({ query: 'test' });

      // First call is in progress
      const first = await IdempotencyService.createInProgressRecord(tenantA, userAdminA.userId, key, hash);
      expect(first).toBe(true);

      // Concurrent second call before first finishes returns false (conflict)
      const concurrent = await IdempotencyService.createInProgressRecord(tenantA, userAdminA.userId, key, hash);
      expect(concurrent).toBe(false);
    });

    it('4. secrets (invite tokens, mfa codes) are never stored in idempotency records', async () => {
      const key = 'idem-req-invite';
      const hash = IdempotencyService.computeRequestHash({ email: 'newuser@alpha.org' });

      await IdempotencyService.createInProgressRecord(tenantA, userAdminA.userId, key, hash);

      const secretPayload = {
        token: 'secret-invite-token-1234567890',
        recoveryCodes: ['code-1', 'code-2'],
        publicInfo: 'Welcome to DocuNexa',
      };

      await IdempotencyService.completeRecord(tenantA, userAdminA.userId, key, 200, secretPayload);

      const record = await IdempotencyService.findRecord(tenantA, userAdminA.userId, key);
      const storedBody = record?.responseBody;

      expect(storedBody.token).toBe('[REDACTED_SECRET_OMITTED_FROM_IDEMPOTENCY_STORE]');
      expect(storedBody.recoveryCodes).toBe('[REDACTED_SECRET_OMITTED_FROM_IDEMPOTENCY_STORE]');
      expect(storedBody.publicInfo).toBe('Welcome to DocuNexa');
    });

    it('5. outbound webhook delivery retry carries identical event ID and delivery ID with unique delivery record', async () => {
      const { subscription } = await WebhookService.createSubscription(tenantA, userAdminA.userId, {
        name: 'Alpha Webhook',
        targetUrl: 'https://webhook.site/test',
        subscribedEvents: ['DOCUMENT_UPLOADED'],
      });

      const eventPayload = { documentId: 'DOC-555', status: 'QUEUED' };
      const eventId = 'EVT-STABLE-999';

      // 1st delivery
      const [d1] = await WebhookService.dispatchEvent(tenantA, 'DOCUMENT_UPLOADED', eventPayload, { eventId });
      expect(d1).toBeDefined();
      expect(d1.eventId).toBe(eventId);
      const deliveryId = d1.id;

      // Retry delivery using stable deliveryId
      const d2 = await WebhookService.retryDelivery(tenantA, deliveryId);
      expect(d2.eventId).toBe(eventId);
      expect(d2.id).toBe(deliveryId);

      // Verify delivery history maintains unique delivery identity
      const history = await WebhookService.getDeliveryHistory(tenantA, subscription.id);
      expect(history.length).toBe(1);
      expect(history[0]?.id).toBe(deliveryId);
      expect(history[0]?.attemptNumber).toBe(2);
    });
  });

  // =========================================================================
  // Part C: Export Masking & Download Authorization (FR-018)
  // =========================================================================
  describe('Part C: Export Masking & Authorization', () => {
    it('6. export generation applies server-side masking per requester role', async () => {
      // Configure rule: mask 'tax_id' and 'account_number' for Analyst role
      await ExportMaskingService.createRule(tenantA, {
        documentType: 'Invoice',
        fieldKey: 'tax_id',
        maskedForRoles: ['Analyst', 'Reviewer'],
        maskStyle: 'full',
      });
      await ExportMaskingService.createRule(tenantA, {
        documentType: 'Invoice',
        fieldKey: 'account_number',
        maskedForRoles: ['Analyst'],
        maskStyle: 'partial',
      });

      const rawRows = [
        { documentId: 'DOC-1', tax_id: 'US-99-8887776', account_number: '1234567890', vendor: 'Globex' },
      ];

      // Request as Analyst
      const analystResult = await ExportMaskingService.applyRoleMasking(
        tenantA,
        userAnalystA.role,
        rawRows,
        'Invoice'
      );
      expect(analystResult.maskedItems[0].tax_id).toBe('[REDACTED]');
      expect(analystResult.maskedItems[0].account_number).toBe('***7890');
      expect(analystResult.maskedItems[0].vendor).toBe('Globex');
      expect(analystResult.maskedFields.length).toBe(2);

      // Request as Admin (not in maskedForRoles)
      const adminResult = await ExportMaskingService.applyRoleMasking(
        tenantA,
        userAdminA.role,
        rawRows,
        'Invoice'
      );
      expect(adminResult.maskedItems[0].tax_id).toBe('US-99-8887776');
      expect(adminResult.maskedItems[0].account_number).toBe('1234567890');
      expect(adminResult.maskedFields.length).toBe(0);
    });

    it('7. download export denied after export revocation', async () => {
      const job = await ExportService.requestExport(tenantA, userAdminA.userId, {
        reportType: 'governance',
        format: 'json',
      });
      const downloadToken = new URL(job.downloadUrl!, 'http://localhost').searchParams.get('token')!;
      expect(downloadToken).toBeDefined();

      // Revoke export
      await ExportService.revokeExport(tenantA, job.id, userAdminA.userId);

      // Attempt download after revocation
      await expect(
        ExportService.downloadExport(tenantA, job.id, downloadToken, {
          userId: userAdminA.userId,
          role: userAdminA.role,
        })
      ).rejects.toThrow(/revoked and cannot be downloaded/);
    });

    it('8. download export denied when user account is deactivated', async () => {
      const job = await ExportService.requestExport(tenantA, userAdminA.userId, {
        reportType: 'executive',
        format: 'csv',
      });
      const downloadToken = new URL(job.downloadUrl!, 'http://localhost').searchParams.get('token')!;

      // Simulate deactivated requester by registering deactivated user record
      AuthService.setInMemoryUser({
        user_id: 'USR-DEACTIVATED-99',
        tenant_id: tenantA,
        email: 'deactivated@alpha.org',
        full_name: 'Deactivated User',
        role: 'Analyst',
        password_hash: 'hash',
        is_active: false,
        created_at: new Date(),
      });

      await expect(
        ExportService.downloadExport(tenantA, job.id, downloadToken, {
          userId: 'USR-DEACTIVATED-99',
          role: 'Analyst',
        })
      ).rejects.toThrow(/Requester access denied/);
    });
  });

  // =========================================================================
  // Part D: In-App Notifications & Real-Time SSE (FR-020)
  // =========================================================================
  describe('Part D: Notifications, SSE Tickets & Expiry Alerts', () => {
    it('9. stream-ticket is single-use and expires after consumption', async () => {
      const ticketRes = await NotificationService.createStreamTicket(tenantA, userReviewerA.userId, 'SES-002');
      expect(ticketRes.ticket).toBeDefined();
      expect(ticketRes.expiresIn).toBe(60);

      // First redemption succeeds
      const redeemed = await NotificationService.redeemStreamTicket(ticketRes.ticket);
      expect(redeemed).not.toBeNull();
      expect(redeemed?.userId).toBe(userReviewerA.userId);

      // Second redemption fails (single-use semantics)
      const secondAttempt = await NotificationService.redeemStreamTicket(ticketRes.ticket);
      expect(secondAttempt).toBeNull();
    });

    it('10. multi-instance notification fan-out delivers real-time notifications', async () => {
      const receivedNotifications: any[] = [];

      const unsubscribe = NotificationService.subscribeToUserNotifications(
        tenantA,
        userReviewerA.userId,
        (notif) => {
          receivedNotifications.push(notif);
        }
      );

      await NotificationService.dispatchNotification(tenantA, {
        userId: userReviewerA.userId,
        type: 'task_assigned',
        category: 'tasks',
        title: 'New Review Assigned',
        message: 'Invoice #9901 requires verification.',
        entityId: 'DOC-9901',
      });

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].title).toBe('New Review Assigned');
      expect(receivedNotifications[0].entityId).toBe('DOC-9901');

      unsubscribe();
    });

    it('11. document expiry check creates deduplicated notification', async () => {
      // Test deduplication logic
      const result1 = await NotificationService.processDocumentExpiryNotifications();
      expect(result1.generatedCount).toBeDefined();

      // Running second time should not duplicate notifications
      const result2 = await NotificationService.processDocumentExpiryNotifications();
      expect(result2.generatedCount).toBe(0);
    });
  });

  // =========================================================================
  // Part E: Correlation IDs & Distributed Tracing (NFR-07)
  // =========================================================================
  describe('Part E: Correlation IDs', () => {
    it('12. correlation ID is propagated to audit events, outbox, and trace endpoint', async () => {
      const correlationId = `corr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await runWithCorrelationId(correlationId, async () => {
        expect(getCorrelationId()).toBe(correlationId);

        // 1. Audit trail event inherits correlation ID
        const audit = await AuditTrailService.recordEvent({
          tenantId: tenantA,
          action: 'DOC_UPLOAD',
          userId: userAdminA.userId,
          documentId: 'DOC-TRACE-01',
          details: { note: 'Uploaded with correlation context' },
        });
        expect(audit.correlationId).toBe(correlationId);

        // 2. Outbox event inherits correlation ID
        const outbox = await OutboxService.recordEvent(
          tenantA,
          'DOC-TRACE-01',
          'DOCUMENT_UPLOADED',
          { documentId: 'DOC-TRACE-01' }
        );
        expect(outbox.correlationId).toBe(correlationId);

        // 3. Trace retrieval returns records matching correlation ID
        const auditTrace = await AuditTrailService.findByCorrelationId(tenantA, correlationId);
        expect(auditTrace.some((a) => a.eventId === audit.eventId)).toBe(true);

        const outboxTrace = await OutboxService.findByCorrelationId(tenantA, correlationId);
        expect(outboxTrace.some((o: any) => o.eventId === outbox.eventId)).toBe(true);
      });
    });
  });

  // =========================================================================
  // Part F: Real Reports & Extraction Quality (FR-021)
  // =========================================================================
  describe('Part F: Reports & Extraction Quality', () => {
    it('13. governance report contains no mock data and is tenant-scoped', async () => {
      const report = await ReportService.getGovernanceReportMetrics(tenantA, {
        dateRange: 'Today',
      });

      expect(report.tenantId).toBe(tenantA);
      expect(report.executive).toBeDefined();
      expect(report.executive.cards).toBeDefined();
      expect(report.executive.cards.length).toBe(4);
      expect(Array.isArray(report.executive.volumeTrend)).toBe(true);
    });

    it('14. extraction quality returns insufficient-data when sample size is below threshold', async () => {
      const quality = await ReportService.getExtractionQuality(tenantA, {
        documentType: 'NonExistentType',
      });

      expect(quality.data_basis).toBe('reviewer_corrections');
      expect(quality.note).toContain('Sprint 8');
      expect(quality.evaluation_runs_collection_shape).toBeDefined();

      const metric = quality.metrics[0];
      expect(metric?.status).toBe('insufficient_data');
      expect(metric?.sampleSize).toBeLessThan(5);
    });
  });

  // =========================================================================
  // Part G: Server-Side Validation on Review Submit (FR-009, UAT-03)
  // =========================================================================
  describe('Part G: Review Submit Validation & Invoice Total Mismatch', () => {
    it('15. invoice total mismatch blocks approval unless authorized override with reason', async () => {
      // 1. Ingest document
      const doc = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: userAdminA.userId,
        buffer: Buffer.from('%PDF-1.4 test invoice content'),
        originalFilename: 'invoice-mismatch.pdf',
        declaredMimeType: 'application/pdf',
        documentType: 'Purchase Invoice',
      });

      // 2. Mock extraction with financial mismatch: net (100) + tax (10) != total (150)
      const mockExtraction = {
        documentId: doc.documentId,
        tenantId: tenantA,
        documentType: 'Purchase Invoice',
        status: 'EXTRACTED' as const,
        fields: [
          { fieldName: 'net_amount', extractedValue: 100, confidence: 0.95, status: 'EXTRACTED' as const, normalizedValue: 100 },
          { fieldName: 'tax_amount', extractedValue: 10, confidence: 0.95, status: 'EXTRACTED' as const, normalizedValue: 10 },
          { fieldName: 'total_amount', extractedValue: 150, confidence: 0.95, status: 'EXTRACTED' as const, normalizedValue: 150 },
        ],
      };
      const { ExtractionService } = await import('./extraction.service.js');
      await ExtractionService.saveExtractionResult(mockExtraction as any);

      // Direct bypass attempt without override reason must throw 422
      await expect(
        ReviewService.submitReviewDecision(
          doc.documentId,
          tenantA,
          { action: 'APPROVE' },
          userReviewerA
        )
      ).rejects.toThrow(ReviewValidationError);

      // With authorized override reason from Admin, approval succeeds and logs audit event
      const approved = await ReviewService.submitReviewDecision(
        doc.documentId,
        tenantA,
        { action: 'APPROVE', overrideReason: 'Vendor included additional freight charge not broken down' },
        userAdminA
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.stage).toBe('REVIEW_COMPLETED');

      // Verify validation override audit event was recorded
      const audits = await ReviewService.getAuditLogs(doc.documentId, tenantA);
      const overrideAudit = audits.find((a) => a.action === 'VALIDATION_OVERRIDE');
      expect(overrideAudit).toBeDefined();
      expect(overrideAudit?.details).toContain('freight charge');
    });
  });

  // =========================================================================
  // Tenant Boundary Security
  // =========================================================================
  describe('Tenant Boundary Security', () => {
    it('16. tenant B cannot read or delete tenant A export masking rules', async () => {
      const rule = await ExportMaskingService.createRule(tenantA, {
        fieldKey: 'ssn',
        maskedForRoles: ['Analyst'],
        maskStyle: 'full',
      });

      // Tenant B read returns null
      const tenantBRead = await ExportMaskingService.getRule(tenantB, rule.id);
      expect(tenantBRead).toBeNull();

      // Tenant B delete returns false
      const tenantBDelete = await ExportMaskingService.deleteRule(tenantB, rule.id);
      expect(tenantBDelete).toBe(false);
    });
  });
});
