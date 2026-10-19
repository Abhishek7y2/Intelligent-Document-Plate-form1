import crypto from 'crypto';
import { IntakeService, OcrNotFoundError } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { ReviewService } from './review.service.js';
import { OutboxService } from './outbox.service.js';
import {
  ApprovalTier,
  ApprovalRequest,
  ApprovalDecision,
  ApprovalDecisionPayload,
  ApprovalQueueItem,
  ApprovalGateStatus,
} from '../models/approval.models.js';
import { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { DocumentRecord } from '../models/intake.models.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

export class SodViolationError extends Error {
  public status: number = 403;
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SodViolationError';
    this.code = code;
  }
}

export class ApprovalGateError extends Error {
  public status: number = 400;
  public code: string;
  constructor(message: string, code: string = 'APPROVAL_GATE_BLOCKED') {
    super(message);
    this.name = 'ApprovalGateError';
    this.code = code;
  }
}

export class StaleVersionError extends Error {
  public status: number = 409;
  public code: string = 'STALE_VERSION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'StaleVersionError';
  }
}

export class ApprovalConflictError extends Error {
  public status: number = 409;
  public code: string = 'APPROVAL_ALREADY_PROCESSED';
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalConflictError';
  }
}

export class ApprovalService {
  private static storeMode: 'memory' | 'database' = 'memory';
  // In-memory state store for isolated testing and fail-safe persistence
  public static inMemoryRequests: Map<string, ApprovalRequest> = new Map();

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStoreMode(): 'memory' | 'database' {
    return this.storeMode;
  }

  /**
   * Resets all in-memory approval requests (used in tests)
   */
  static resetState(): void {
    this.inMemoryRequests.clear();
  }

  /**
   * Determines monetary approval tier according to BRD/PRD rules:
   * - Below $10,000 (< 10000.00): Tier 1 (1 Approver)
   * - $10,000 through $50,000 [10000.00, 50000.00]: Tier 2 (2 Approvers)
   * - Above $50,000 (> 50000.00): Tier 3 (2 Approvers, Executive/FinanceHead required)
   * - Missing / NaN / Invalid / Negative: Fails safe to Tier 3 (Executive)
   */
  static determineTier(amount: number | null, docType?: string): { tier: ApprovalTier; requiredApprovals: number } {
    if (docType === 'internal-policy') {
      return { tier: 'TIER_1', requiredApprovals: 1 };
    }

    if (amount === null || amount === undefined || isNaN(amount) || amount < 0) {
      // Fail-safe: missing or invalid financial values must NOT bypass workflow
      return { tier: 'TIER_3', requiredApprovals: 2 };
    }

    if (amount < 10000.0) {
      return { tier: 'TIER_1', requiredApprovals: 1 };
    } else if (amount <= 50000.0) {
      return { tier: 'TIER_2', requiredApprovals: 2 };
    } else {
      return { tier: 'TIER_3', requiredApprovals: 2 };
    }
  }

  /**
   * Fetches or initializes an ApprovalRequest for a document
   */
  static async getOrCreateApprovalRequest(documentId: string, tenantId: string): Promise<ApprovalRequest> {
    const key = `${tenantId}:${documentId}`;
    let req = this.inMemoryRequests.get(key);
    if (req) {
      return req;
    }

    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    // Determine extracted monetary amount
    let monetaryAmount: number | null = null;
    let currency = 'USD';
    try {
      const extraction = await ExtractionService.getExtraction(documentId, tenantId);
      if (extraction && extraction.fields) {
        const totalField = extraction.fields.find(
          (f: any) => f.fieldName === 'total_amount' || f.fieldName === 'net_amount'
        );
        if (totalField && totalField.extractedValue !== null && totalField.extractedValue !== undefined) {
          const parsed = parseFloat(String(totalField.extractedValue).replace(/[^0-9.-]+/g, ''));
          if (!isNaN(parsed)) {
            monetaryAmount = parsed;
          }
        }
      }
    } catch {
      // No extraction yet
    }

    const { tier, requiredApprovals } = this.determineTier(monetaryAmount, doc.documentType);

    // Identify reviewer if HITL review was recorded
    let reviewedBy: string | undefined = undefined;
    const reviewTask = ReviewService.inMemoryTasks.get(key);
    if (reviewTask && reviewTask.assignee) {
      reviewedBy = reviewTask.assignee;
    }

    req = {
      id: `APP-REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentId,
      tenantId,
      status: 'PENDING',
      tier,
      monetaryAmount,
      currency,
      requiredApprovals,
      approvedCount: 0,
      sourceVersion: 'v1.0',
      submittedBy: doc.assignedTo || 'system_uploader',
      reviewedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decisions: [],
    };

    this.inMemoryRequests.set(key, req);
    return req;
  }

  /**
   * Evaluates Separation of Duties (SoD) compliance for the given user:
   * 1. Submitter cannot approve
   * 2. Reviewer who corrected/verified fields cannot approve
   * 3. Same approver cannot sign multiple tiers (no self-quorum)
   */
  static async evaluateSod(
    request: ApprovalRequest,
    user: AuthenticatedUser,
    doc: DocumentRecord
  ): Promise<{ allowed: boolean; violationCode?: string; message?: string }> {
    const userId = user.userId;
    const userEmail = user.email;

    // 1. Submitter / Uploader check
    if (
      request.submittedBy === userId ||
      request.submittedBy === userEmail ||
      doc.assignedTo === userId ||
      doc.assignedTo === userEmail
    ) {
      return {
        allowed: false,
        violationCode: 'SOD_VIOLATION_SUBMITTER',
        message: `Separation of Duties violation: Submitter '${userEmail}' is strictly prohibited from approving own document.`,
      };
    }

    // 2. Reviewer check (maker-checker principle)
    if (
      request.reviewedBy === userId ||
      request.reviewedBy === userEmail
    ) {
      return {
        allowed: false,
        violationCode: 'SOD_VIOLATION_REVIEWER',
        message: `Separation of Duties violation: Reviewer '${userEmail}' cannot act as approver (maker-checker violation).`,
      };
    }

    // Inspect field corrections history
    const auditLogs = await ReviewService.getAuditLogs(doc.documentId, doc.tenantId);
    const hasCorrected = auditLogs.some(
      (log) => (log.actor === userEmail || log.actor === userId) && log.action === 'FIELD_CORRECTION'
    );
    if (hasCorrected) {
      return {
        allowed: false,
        violationCode: 'SOD_VIOLATION_REVIEWER',
        message: `Separation of Duties violation: User '${userEmail}' made field corrections on this document and cannot grant approval.`,
      };
    }

    // 3. Multi-Tier Duplicate Approver check
    const alreadyApproved = request.decisions.some(
      (d) => (d.approverId === userId || d.approverName === userEmail) && d.decision === 'APPROVE'
    );
    if (alreadyApproved) {
      return {
        allowed: false,
        violationCode: 'SOD_VIOLATION_DUPLICATE_APPROVER',
        message: `Separation of Duties violation: Approver '${userEmail}' has already signed an approval step for this document.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validates pre-flight gate conditions
   */
  static async validateGateConditions(
    doc: DocumentRecord,
    request: ApprovalRequest,
    expectedVersion?: string
  ): Promise<ApprovalGateStatus> {
    if (doc.status === 'QUARANTINED') {
      return {
        allRequiredFieldsComplete: false,
        blockingExceptionsResolved: false,
        sourceVersionCurrent: false,
        missingFieldsCount: 0,
        unresolvedExceptionsCount: 1,
        gateSatisfied: false,
        gateMessage: 'Document is quarantined due to security threats.',
      };
    }

    let blockingExceptionsResolved = true;
    let unresolvedExceptionsCount = 0;
    let missingFieldsCount = 0;

    // Check arithmetic reconciliation from extraction
    try {
      const extraction = await ExtractionService.getExtraction(doc.documentId, doc.tenantId);
      if (extraction && extraction.validationSummary?.reconciliationResult) {
        if (!extraction.validationSummary.reconciliationResult.isReconciled) {
          blockingExceptionsResolved = false;
          unresolvedExceptionsCount++;
        }
      }
    } catch {
      // extraction not found
    }

    const sourceVersionCurrent = !expectedVersion || expectedVersion === request.sourceVersion;
    const gateSatisfied = blockingExceptionsResolved && sourceVersionCurrent;

    return {
      allRequiredFieldsComplete: missingFieldsCount === 0,
      blockingExceptionsResolved,
      sourceVersionCurrent,
      missingFieldsCount,
      unresolvedExceptionsCount,
      gateSatisfied,
      gateMessage: gateSatisfied
        ? 'All gate conditions satisfied. Ready for sign-off.'
        : `Gate blocked: ${unresolvedExceptionsCount} unresolved exceptions or version mismatch.`,
    };
  }

  /**
   * Submits an authoritative approval decision (FR-010, FR-011)
   */
  static async submitApprovalDecision(
    documentId: string,
    tenantId: string,
    payload: ApprovalDecisionPayload,
    user: AuthenticatedUser
  ): Promise<{ request: ApprovalRequest; isFullyApproved: boolean; published: boolean }> {
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    const request = await this.getOrCreateApprovalRequest(documentId, tenantId);

    // Stale/Already completed check
    if (request.status === 'APPROVED' && request.approvedCount >= request.requiredApprovals) {
      throw new ApprovalConflictError(`Document '${documentId}' has already completed approval workflow.`);
    }

    if (request.status === 'REJECTED') {
      throw new ApprovalConflictError(`Document '${documentId}' was previously rejected.`);
    }

    // Version currency check
    if (payload.sourceVersion && payload.sourceVersion !== request.sourceVersion) {
      throw new StaleVersionError(
        `Version conflict: Submitted version '${payload.sourceVersion}' is superseded by active version '${request.sourceVersion}'.`
      );
    }

    const gate = await this.validateGateConditions(doc, request, payload.sourceVersion);
    if (!gate.gateSatisfied && payload.action === 'APPROVE') {
      throw new ApprovalGateError(gate.gateMessage);
    }

    // Action handling
    if (payload.action === 'APPROVE') {
      // Evaluate SoD
      const sod = await this.evaluateSod(request, user, doc);
      if (!sod.allowed) {
        throw new SodViolationError(sod.message || 'SoD violation.', sod.violationCode || 'SOD_VIOLATION');
      }

      // Check Tier 3 Executive role requirement
      if (request.tier === 'TIER_3') {
        const isExecutive = user.role === 'Admin' || user.role === 'FinanceHead';
        // In Tier 3, if this is the final required approval, an executive must sign
        if (request.approvedCount + 1 >= request.requiredApprovals && !isExecutive) {
          const hasPriorExecutive = request.decisions.some(
            (d) => d.approverRole === 'Admin' || d.approverRole === 'FinanceHead'
          );
          if (!hasPriorExecutive) {
            throw new SodViolationError(
              `Tier 3 approval ($> $50,000) mandates at least one FinanceHead or Admin executive signature.`,
              'EXECUTIVE_APPROVAL_REQUIRED'
            );
          }
        }
      }

      // Generate SHA-256 digital signature hash
      const sigData = `${documentId}:${request.id}:${user.userId}:${payload.action}:${Date.now()}`;
      const signatureHash = crypto.createHash('sha256').update(sigData).digest('hex');

      const decision: ApprovalDecision = {
        id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requestId: request.id,
        documentId,
        tenantId,
        approverId: user.userId,
        approverName: user.email,
        approverRole: user.role,
        decision: 'APPROVE',
        reasonCode: payload.reasonCode || 'Verified & Compliant',
        comments: payload.comments,
        signatureHash,
        sourceVersion: request.sourceVersion,
        timestamp: new Date().toISOString(),
      };

      const previousDecisions = [...request.decisions];
      const previousCount = request.approvedCount;
      const previousStatus = request.status;

      request.decisions.push(decision);
      request.approvedCount += 1;
      request.updatedAt = new Date().toISOString();

      let isFullyApproved = false;
      let published = false;

      if (request.approvedCount >= request.requiredApprovals) {
        request.status = 'APPROVED';
        isFullyApproved = true;

        if (this.storeMode === 'database') {
          const client = await dbPool.connect();
          try {
            await client.query('BEGIN');

            // 1. Insert approval decision
            await client.query(
              `INSERT INTO approval_decisions (
                decision_id, request_id, document_id, tenant_id, approver_id, approver_name,
                approver_role, decision, reason_code, comments, signature_hash, source_version, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                decision.id, request.id, documentId, tenantId, user.userId, user.email,
                user.role, 'APPROVE', decision.reasonCode, decision.comments,
                decision.signatureHash, decision.sourceVersion, decision.timestamp,
              ]
            );

            // 2. Update approval request
            await client.query(
              `UPDATE approval_requests
               SET status = 'APPROVED', approved_count = $1, updated_at = NOW()
               WHERE request_id = $2 AND tenant_id = $3`,
              [request.approvedCount, request.id, tenantId]
            );

            // 3. Update document status
            await client.query(
              `UPDATE documents
               SET status = 'APPROVED', stage = 'APPROVED_PENDING_PUBLISH', processed_at = NOW()
               WHERE document_id = $1 AND tenant_id = $2`,
              [documentId, tenantId]
            );

            // 4. Record transactional outbox events using the SAME transaction-bound client
            await OutboxService.recordEvent(
              tenantId,
              documentId,
              'DOCUMENT_PUBLISHED',
              {
                sourceVersion: request.sourceVersion,
                amount: request.monetaryAmount,
              },
              client
            );

            await OutboxService.recordEvent(
              tenantId,
              documentId,
              'INDEX_DOCUMENT_REQUESTED',
              {
                sourceVersion: request.sourceVersion,
              },
              client
            );

            await client.query('COMMIT');
          } catch (txErr) {
            await client.query('ROLLBACK');
            request.decisions = previousDecisions;
            request.approvedCount = previousCount;
            request.status = previousStatus;
            throw txErr;
          } finally {
            client.release();
          }
        } else {
          // In-Memory atomic transaction boundary
          const recordedEventIds: string[] = [];

          try {
            await IntakeService.updateDocument(documentId, tenantId, {
              status: 'APPROVED',
              stage: 'APPROVED_PENDING_PUBLISH',
            });

            const evt1 = await OutboxService.recordEvent(tenantId, documentId, 'DOCUMENT_PUBLISHED', {
              sourceVersion: request.sourceVersion,
              amount: request.monetaryAmount,
            });
            recordedEventIds.push(evt1.eventId);

            const evt2 = await OutboxService.recordEvent(tenantId, documentId, 'INDEX_DOCUMENT_REQUESTED', {
              sourceVersion: request.sourceVersion,
            });
            recordedEventIds.push(evt2.eventId);
          } catch (memErr) {
            // Atomic rollback in-memory state
            request.decisions = previousDecisions;
            request.approvedCount = previousCount;
            request.status = previousStatus;
            await IntakeService.updateDocument(documentId, tenantId, {
              status: 'PENDING_APPROVAL',
              stage: 'AWAITING_TIER_APPROVAL',
            });
            for (const eid of recordedEventIds) {
              OutboxService.removeEvent(eid);
            }
            throw memErr;
          }
        }

        // 5. Network dispatch is strictly asynchronous and OUTSIDE the database transaction
        try {
          await OutboxService.processPendingEvents(tenantId);
          const docNow = await IntakeService.getDocument(documentId, tenantId);
          if (docNow?.status === 'PUBLISHED') {
            published = true;
          }
        } catch (outboxErr) {
          Logger.error({
            context: 'ApprovalService',
            message: `Immediate outbox event processing failed for approved document ${documentId}; events will be durably retried`,
            data: { documentId, tenantId, error: (outboxErr as Error).message },
          });
        }
      } else {
        request.status = 'IN_PROGRESS';
        await IntakeService.updateDocument(documentId, tenantId, {
          status: 'PENDING_APPROVAL',
          stage: 'AWAITING_TIER_APPROVAL',
        });
      }

      this.inMemoryRequests.set(`${tenantId}:${documentId}`, request);
      return { request, isFullyApproved, published };
    } else if (payload.action === 'REJECT') {
      if (!payload.comments || !payload.comments.trim()) {
        throw new ApprovalGateError('Mandatory reason comment is required for rejection.', 'REASON_REQUIRED');
      }

      const sigData = `${documentId}:${request.id}:${user.userId}:REJECT:${Date.now()}`;
      const signatureHash = crypto.createHash('sha256').update(sigData).digest('hex');

      const decision: ApprovalDecision = {
        id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requestId: request.id,
        documentId,
        tenantId,
        approverId: user.userId,
        approverName: user.email,
        approverRole: user.role,
        decision: 'REJECT',
        reasonCode: payload.reasonCode,
        comments: payload.comments,
        signatureHash,
        sourceVersion: request.sourceVersion,
        timestamp: new Date().toISOString(),
      };

      request.decisions.push(decision);
      request.status = 'REJECTED';
      request.updatedAt = new Date().toISOString();

      await IntakeService.updateDocument(documentId, tenantId, {
        status: 'REJECTED',
        stage: 'REJECTED_BY_APPROVER',
      });

      this.inMemoryRequests.set(`${tenantId}:${documentId}`, request);
      return { request, isFullyApproved: false, published: false };
    } else if (payload.action === 'RETURN_FOR_CHANGES') {
      if (!payload.comments || !payload.comments.trim()) {
        throw new ApprovalGateError('Mandatory reason comment is required for returning document.', 'REASON_REQUIRED');
      }

      const sigData = `${documentId}:${request.id}:${user.userId}:RETURN:${Date.now()}`;
      const signatureHash = crypto.createHash('sha256').update(sigData).digest('hex');

      const decision: ApprovalDecision = {
        id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requestId: request.id,
        documentId,
        tenantId,
        approverId: user.userId,
        approverName: user.email,
        approverRole: user.role,
        decision: 'RETURN_FOR_CHANGES',
        reasonCode: payload.reasonCode,
        comments: payload.comments,
        signatureHash,
        sourceVersion: request.sourceVersion,
        timestamp: new Date().toISOString(),
      };

      request.decisions.push(decision);
      request.status = 'RETURNED';
      request.updatedAt = new Date().toISOString();

      await IntakeService.updateDocument(documentId, tenantId, {
        status: 'NEEDS_REVIEW',
        stage: 'CHANGES_REQUESTED',
      });

      this.inMemoryRequests.set(`${tenantId}:${documentId}`, request);
      return { request, isFullyApproved: false, published: false };
    } else {
      throw new ApprovalGateError(`Invalid action '${payload.action}'. Must be APPROVE, REJECT, or RETURN_FOR_CHANGES.`);
    }
  }

  /**
   * Retrieves the approval queue for a tenant
   */
  static async getApprovalQueue(tenantId: string): Promise<ApprovalQueueItem[]> {
    const docs = await IntakeService.listDocuments(tenantId);
    const queue: ApprovalQueueItem[] = [];

    for (const doc of docs) {
      if (
        doc.status === 'PENDING_APPROVAL' ||
        doc.status === 'NEEDS_REVIEW' ||
        doc.status === 'APPROVED' ||
        doc.stage === 'REVIEW_COMPLETED' ||
        doc.stage === 'AWAITING_TIER_APPROVAL'
      ) {
        const req = await this.getOrCreateApprovalRequest(doc.documentId, tenantId);
        queue.push({
          id: req.id,
          documentId: doc.documentId,
          tenantId,
          documentTitle: doc.fileName,
          documentType: doc.documentType,
          tier: req.tier,
          amount: req.monetaryAmount,
          currency: req.currency,
          submittedBy: req.submittedBy,
          reviewedBy: req.reviewedBy,
          status: req.status,
          requiredApprovals: req.requiredApprovals,
          approvedCount: req.approvedCount,
          priority: req.tier === 'TIER_3' ? 'High' : req.tier === 'TIER_2' ? 'Medium' : 'Low',
          submittedAt: doc.uploadedAt ? doc.uploadedAt.toISOString() : new Date().toISOString(),
          sourceVersion: req.sourceVersion,
        });
      }
    }

    return queue;
  }
}
