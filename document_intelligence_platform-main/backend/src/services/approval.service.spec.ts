import {
  ApprovalService,
  SodViolationError,
  ApprovalGateError,
  StaleVersionError,
  ApprovalConflictError,
} from './approval.service.js';
import { IntakeService } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { ReviewService } from './review.service.js';
import { ErpPublisherService } from './erp-publisher.service.js';
import { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { DocumentExtractionResult } from '../models/extraction.models.js';

describe('ApprovalService (Sprint 8 - FR-010, FR-011)', () => {
  const tenantId = 'TENANT-ALPHA';
  const uploaderUser: AuthenticatedUser = {
    userId: 'USER-UPLOADER',
    email: 'uploader@alpha.com',
    tenantId,
    role: 'Analyst',
    permissions: ['DOC_VIEW', 'DOC_UPLOAD'],
  };

  const reviewerUser: AuthenticatedUser = {
    userId: 'USER-REVIEWER',
    email: 'reviewer@alpha.com',
    tenantId,
    role: 'Reviewer',
    permissions: ['DOC_VIEW', 'DOC_EDIT', 'DOC_VERIFY'],
  };

  const approver1: AuthenticatedUser = {
    userId: 'USER-APPROVER-1',
    email: 'approver1@alpha.com',
    tenantId,
    role: 'Approver',
    permissions: ['DOC_VIEW', 'DOC_APPROVE'],
  };

  const approver2: AuthenticatedUser = {
    userId: 'USER-APPROVER-2',
    email: 'approver2@alpha.com',
    tenantId,
    role: 'Approver',
    permissions: ['DOC_VIEW', 'DOC_APPROVE'],
  };

  const financeHead: AuthenticatedUser = {
    userId: 'USER-FIN-HEAD',
    email: 'finhead@alpha.com',
    tenantId,
    role: 'FinanceHead',
    permissions: ['DOC_VIEW', 'DOC_APPROVE'],
  };

  const setupDoc = (docId: string, assignedTo = 'USER-UPLOADER', status: any = 'NEEDS_REVIEW') => {
    IntakeService.setInMemoryDocument({
      documentId: docId,
      tenantId,
      fileName: `${docId}.pdf`,
      storagePath: `tenants/${tenantId}/${docId}.pdf`,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      sha256Hash: `hash-${docId}`,
      documentType: 'purchase-invoice',
      status,
      stage: 'REVIEW_COMPLETED',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      assignedTo,
      pageCount: 1,
      uploadedAt: new Date(),
    });
  };

  const setupExtraction = (docId: string, total = 5000, isReconciled = true) => {
    const extraction: DocumentExtractionResult = {
      extractionId: `EXT-${docId}`,
      documentId: docId,
      tenantId,
      documentType: 'purchase-invoice',
      templateVersion: 'v2.1',
      fields: [
        {
          fieldId: `F-1-${docId}`,
          fieldName: 'invoice_number',
          label: 'Invoice Number',
          dataType: 'string',
          extractedValue: 'INV-100',
          confidence: 0.95,
          status: 'EXTRACTED',
        },
        {
          fieldId: `F-2-${docId}`,
          fieldName: 'total_amount',
          label: 'Total Amount',
          dataType: 'number',
          extractedValue: total,
          confidence: 0.95,
          status: 'EXTRACTED',
        },
      ],
      validationSummary: {
        isValid: isReconciled,
        totalFieldsExpected: 2,
        totalFieldsExtracted: 2,
        missingRequiredFields: [],
        lowConfidenceFields: [],
        reconciliationResult: {
          status: isReconciled ? 'MATCHED' : 'MISMATCH',
          netAmount: total * 0.8,
          taxAmount: total * 0.2,
          totalAmount: total,
          expectedTotal: total,
          delta: isReconciled ? 0 : 100,
          isReconciled,
          discrepancyReason: isReconciled ? undefined : 'Discrepancy detected',
        },
      },
      routingDecision: 'NEEDS_REVIEW',
      extractedAt: new Date().toISOString(),
    };
    ExtractionService.saveExtractionResult(extraction);
  };

  beforeEach(() => {
    IntakeService.clearInMemory();
    ExtractionService.clearInMemory();
    ReviewService.clearInMemory();
    ApprovalService.resetState();
    ErpPublisherService.resetState();
  });

  describe('Monetary Threshold Rules & Boundary Inclusivity', () => {
    it('should assign Tier 1 (1 approver) for amounts strictly below $10,000.00', () => {
      expect(ApprovalService.determineTier(0)).toEqual({ tier: 'TIER_1', requiredApprovals: 1 });
      expect(ApprovalService.determineTier(500)).toEqual({ tier: 'TIER_1', requiredApprovals: 1 });
      expect(ApprovalService.determineTier(9999.99)).toEqual({ tier: 'TIER_1', requiredApprovals: 1 });
    });

    it('should assign Tier 2 (2 approvers) exactly at the $10,000.00 boundary', () => {
      expect(ApprovalService.determineTier(10000.0)).toEqual({ tier: 'TIER_2', requiredApprovals: 2 });
    });

    it('should assign Tier 2 (2 approvers) within $10,000 through $50,000', () => {
      expect(ApprovalService.determineTier(25000.0)).toEqual({ tier: 'TIER_2', requiredApprovals: 2 });
    });

    it('should assign Tier 2 (2 approvers) exactly at the $50,000.00 boundary', () => {
      expect(ApprovalService.determineTier(50000.0)).toEqual({ tier: 'TIER_2', requiredApprovals: 2 });
    });

    it('should assign Tier 3 (executive sign-off) immediately above $50,000.00 boundary ($50,000.01)', () => {
      expect(ApprovalService.determineTier(50000.01)).toEqual({ tier: 'TIER_3', requiredApprovals: 2 });
      expect(ApprovalService.determineTier(1250000.0)).toEqual({ tier: 'TIER_3', requiredApprovals: 2 });
    });

    it('should fail-safe to Tier 3 when monetary value is null, undefined, NaN, or negative', () => {
      expect(ApprovalService.determineTier(null)).toEqual({ tier: 'TIER_3', requiredApprovals: 2 });
      expect(ApprovalService.determineTier(undefined as any)).toEqual({ tier: 'TIER_3', requiredApprovals: 2 });
      expect(ApprovalService.determineTier(NaN)).toEqual({ tier: 'TIER_3', requiredApprovals: 2 });
      expect(ApprovalService.determineTier(-150.0)).toEqual({ tier: 'TIER_3', requiredApprovals: 2 });
    });

    it('should assign Tier 1 for non-financial internal-policy documents', () => {
      expect(ApprovalService.determineTier(null, 'internal-policy')).toEqual({
        tier: 'TIER_1',
        requiredApprovals: 1,
      });
    });
  });

  describe('Separation of Duties (SoD) Enforcer', () => {
    it('should reject approval attempt if active user uploaded the document (SOD_VIOLATION_SUBMITTER)', async () => {
      setupDoc('DOC-SOD-1', uploaderUser.userId);

      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-SOD-1',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          uploaderUser
        )
      ).rejects.toThrow(SodViolationError);

      try {
        await ApprovalService.submitApprovalDecision(
          'DOC-SOD-1',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          uploaderUser
        );
      } catch (err: any) {
        expect(err.code).toBe('SOD_VIOLATION_SUBMITTER');
        expect(err.status).toBe(403);
      }
    });

    it('should reject approval attempt if active user reviewed or corrected fields on the document (SOD_VIOLATION_REVIEWER)', async () => {
      setupDoc('DOC-SOD-2', uploaderUser.userId);
      setupExtraction('DOC-SOD-2', 5000);

      // Reviewer makes field correction
      await ReviewService.correctField(
        'DOC-SOD-2',
        tenantId,
        'invoice_number',
        { correctedValue: 'INV-100-CORRECTED' },
        reviewerUser
      );

      // Now reviewer attempts to approve document
      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-SOD-2',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          reviewerUser
        )
      ).rejects.toThrow(SodViolationError);

      try {
        await ApprovalService.submitApprovalDecision(
          'DOC-SOD-2',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          reviewerUser
        );
      } catch (err: any) {
        expect(err.code).toBe('SOD_VIOLATION_REVIEWER');
        expect(err.status).toBe(403);
      }
    });

    it('should reject duplicate approval by the same approver in multi-tier quorum (SOD_VIOLATION_DUPLICATE_APPROVER)', async () => {
      setupDoc('DOC-SOD-3', uploaderUser.userId);
      setupExtraction('DOC-SOD-3', 25000);

      // Step 1: Approver 1 signs
      const res1 = await ApprovalService.submitApprovalDecision(
        'DOC-SOD-3',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
        approver1
      );
      expect(res1.isFullyApproved).toBe(false);
      expect(res1.request.approvedCount).toBe(1);

      // Approver 1 attempts to sign Step 2 again
      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-SOD-3',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          approver1
        )
      ).rejects.toThrow(SodViolationError);

      try {
        await ApprovalService.submitApprovalDecision(
          'DOC-SOD-3',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          approver1
        );
      } catch (err: any) {
        expect(err.code).toBe('SOD_VIOLATION_DUPLICATE_APPROVER');
      }
    });
  });

  describe('Approval Workflow Progression & Gate Conditions', () => {
    it('should block approval if document has unresolved arithmetic discrepancies', async () => {
      setupDoc('DOC-GATE-1', uploaderUser.userId);
      setupExtraction('DOC-GATE-1', 5000, false);

      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-GATE-1',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          approver1
        )
      ).rejects.toThrow(ApprovalGateError);
    });

    it('should reject stale approval when sourceVersion does not match active version', async () => {
      setupDoc('DOC-STALE-1', uploaderUser.userId);

      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-STALE-1',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant', sourceVersion: 'v0.9-stale' },
          approver1
        )
      ).rejects.toThrow(StaleVersionError);
    });

    it('should successfully complete single-stage approval for Tier 1 (<$10k) and dispatch ERP publishing', async () => {
      setupDoc('DOC-TIER-1', uploaderUser.userId);
      setupExtraction('DOC-TIER-1', 4500, true);

      const outcome = await ApprovalService.submitApprovalDecision(
        'DOC-TIER-1',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
        approver1
      );

      expect(outcome.isFullyApproved).toBe(true);
      expect(outcome.published).toBe(true);
      expect(outcome.request.status).toBe('APPROVED');
      expect(outcome.request.decisions[0].signatureHash).toHaveLength(64);

      // Verify document status updated to PUBLISHED
      const updatedDoc = await IntakeService.getDocument('DOC-TIER-1', tenantId);
      expect(updatedDoc?.status).toBe('PUBLISHED');
      expect(updatedDoc?.stage).toBe('ERP_PUBLISHED');
    });

    it('should require 2 distinct approvers for Tier 2 ($10k-$50k) before publishing', async () => {
      setupDoc('DOC-TIER-2', uploaderUser.userId);
      setupExtraction('DOC-TIER-2', 50000.0, true);

      // Step 1: Approver 1 signs
      const step1 = await ApprovalService.submitApprovalDecision(
        'DOC-TIER-2',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
        approver1
      );
      expect(step1.isFullyApproved).toBe(false);
      expect(step1.published).toBe(false);

      const midDoc = await IntakeService.getDocument('DOC-TIER-2', tenantId);
      expect(midDoc?.status).toBe('PENDING_APPROVAL');

      // Step 2: Approver 2 signs
      const step2 = await ApprovalService.submitApprovalDecision(
        'DOC-TIER-2',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
        approver2
      );
      expect(step2.isFullyApproved).toBe(true);
      expect(step2.published).toBe(true);
      expect(step2.request.approvedCount).toBe(2);

      const finalDoc = await IntakeService.getDocument('DOC-TIER-2', tenantId);
      expect(finalDoc?.status).toBe('PUBLISHED');
    });

    it('should mandate FinanceHead or Admin executive sign-off for Tier 3 (>$50k)', async () => {
      setupDoc('DOC-TIER-3', uploaderUser.userId);
      setupExtraction('DOC-TIER-3', 75000.0, true);

      // Step 1: Approver 1 signs
      await ApprovalService.submitApprovalDecision(
        'DOC-TIER-3',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
        approver1
      );

      // Step 2: Approver 2 attempts to sign (without executive role) -> blocked!
      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-TIER-3',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          approver2
        )
      ).rejects.toThrow(SodViolationError);

      // Step 2: FinanceHead signs -> success!
      const step2 = await ApprovalService.submitApprovalDecision(
        'DOC-TIER-3',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Executive Sanction Signed' },
        financeHead
      );
      expect(step2.isFullyApproved).toBe(true);
      expect(step2.published).toBe(true);
    });

    it('should support rejection with mandatory reason and comments', async () => {
      setupDoc('DOC-REJ-1', uploaderUser.userId);

      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-REJ-1',
          tenantId,
          { action: 'REJECT', reasonCode: 'Arithmetic Discrepancy', comments: '' },
          approver1
        )
      ).rejects.toThrow(ApprovalGateError);

      const rej = await ApprovalService.submitApprovalDecision(
        'DOC-REJ-1',
        tenantId,
        { action: 'REJECT', reasonCode: 'Arithmetic Discrepancy', comments: 'Line items do not add up.' },
        approver1
      );

      expect(rej.request.status).toBe('REJECTED');
      const updatedDoc = await IntakeService.getDocument('DOC-REJ-1', tenantId);
      expect(updatedDoc?.status).toBe('REJECTED');
    });

    it('should prevent repeated decision once document is already approved or rejected', async () => {
      setupDoc('DOC-REPEAT-1', uploaderUser.userId);
      setupExtraction('DOC-REPEAT-1', 2000, true);

      await ApprovalService.submitApprovalDecision(
        'DOC-REPEAT-1',
        tenantId,
        { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
        approver1
      );

      // Attempting to approve again
      await expect(
        ApprovalService.submitApprovalDecision(
          'DOC-REPEAT-1',
          tenantId,
          { action: 'APPROVE', reasonCode: 'Verified & Compliant' },
          approver2
        )
      ).rejects.toThrow(ApprovalConflictError);
    });
  });
});
