import { ReviewTask, ReviewWorkbenchData, FieldCorrection, ReviewAuditEvent, FieldCorrectionRequest, ReviewDecisionRequest } from '../models/review.models.js';
import { IntakeService, DocumentNotEligibleError, OcrNotFoundError } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { OcrService } from './ocr.service.js';
import { reconcileInvoiceAmounts } from '../utils/invoice-math-reconciler.js';
import { Logger } from '../utils/logger.js';
import { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { DocumentStatus } from '../models/intake.models.js';
import { ExtractedField } from '../models/extraction.models.js';
import { dbPool } from '../database/postgres.client.js';
import { NotificationService } from './notification.service.js';

export class ReviewValidationError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 422, code = 'VALIDATION_FAILED', details?: any) {
    super(message);
    this.name = 'ReviewValidationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ReviewService {
  private static storeMode: 'memory' | 'database' = 'memory';
  public static inMemoryTasks = new Map<string, ReviewTask>();
  public static inMemoryCorrections = new Map<string, FieldCorrection[]>();
  public static inMemoryAuditEvents = new Map<string, ReviewAuditEvent[]>();

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static clearInMemory(): void {
    this.inMemoryTasks.clear();
    this.inMemoryCorrections.clear();
    this.inMemoryAuditEvents.clear();
  }

  /**
   * Retrieves review queue for a tenant (FR-008)
   */
  static async getReviewQueue(tenantId: string): Promise<ReviewTask[]> {
    // 1. Fetch documents from intake matching needs-review states
    const docs = await IntakeService.listDocuments(tenantId);
    const reviewDocs = docs.filter(
      (d) =>
        d.status === 'NEEDS_REVIEW' ||
        d.stage === 'HITL_REVIEW_PENDING' ||
        d.stage === 'CLASSIFICATION_TRIAGE'
    );

    const tasks: ReviewTask[] = [];

    for (const doc of reviewDocs) {
      // Check if existing task exists
      const existing = this.inMemoryTasks.get(`${tenantId}:${doc.documentId}`);
      if (existing) {
        tasks.push(existing);
        continue;
      }

      // Check extraction confidence and reconciliation status if available
      let hasMismatch = false;
      let hasLowConfidenceField = false;
      let conf = doc.confidenceScore !== null && doc.confidenceScore !== undefined ? doc.confidenceScore : 0.85;
      try {
        const ext = await ExtractionService.getExtraction(doc.documentId, tenantId);
        if (ext) {
          if (ext.validationSummary?.reconciliationResult?.status === 'MISMATCH') {
            hasMismatch = true;
          }
          if (ext.validationSummary?.lowConfidenceFields && ext.validationSummary.lowConfidenceFields.length > 0) {
            hasLowConfidenceField = true;
          }
          if (ext.fields && ext.fields.length > 0) {
            const sum = ext.fields.reduce((acc, f) => acc + (f.confidence || 0), 0);
            conf = sum / ext.fields.length;
          }
        }
      } catch {
        // Fallback default
      }

      const priority = (conf < 0.8 || hasMismatch || hasLowConfidenceField || (doc.confidenceScore !== null && doc.confidenceScore < 0.8)) ? 'High' : 'Medium';

      const task: ReviewTask = {
        id: doc.documentId,
        docId: doc.documentId,
        tenantId,
        documentTitle: doc.fileName || doc.documentId,
        assignee: doc.assignedTo || 'Unassigned',
        slaHoursLeft: 12.0,
        status: 'Pending Review',
        priority,
        confidence: Math.round(conf <= 1.0 ? conf * 100 : conf),
        pages: doc.pageCount || 1,
        submittedAt: doc.uploadedAt ? new Date(doc.uploadedAt).toISOString() : new Date().toISOString(),
        type: doc.documentType || 'Purchase Invoice',
      };

      this.inMemoryTasks.set(`${tenantId}:${doc.documentId}`, task);
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Retrieves full aggregated Review Workbench data for split-pane UI (FR-008)
   */
  static async getReviewWorkbenchData(documentId: string, tenantId: string): Promise<ReviewWorkbenchData> {
    // 1. Check document and tenant fence
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    // 2. Pre-flight eligibility gates
    if (doc.status === 'QUARANTINED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is quarantined due to malware and cannot be reviewed.`,
        403,
        'DOCUMENT_QUARANTINED'
      );
    }

    if (doc.status === 'REJECTED') {
      throw new DocumentNotEligibleError(`Document '${documentId}' is marked as rejected.`, 400, 'DOCUMENT_REJECTED');
    }

    if (doc.status === 'PENDING_SCAN') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' has not completed pre-flight security scan.`,
        400,
        'DOCUMENT_NOT_SCANNED'
      );
    }

    // 3. Fetch extraction results
    const extraction = await ExtractionService.getExtraction(documentId, tenantId);

    // 4. Fetch OCR geometry if available
    let ocrResult = null;
    try {
      ocrResult = await OcrService.getOcrResult(documentId, tenantId);
    } catch {
      // OCR might be pending or in synthetic mock
    }

    // 5. Construct visual bounding boxes and mapped workbench fields
    const boundingBoxes: any[] = [];
    const fields: any[] = [];

    const pageDimensions = (ocrResult?.pages || []).map((p) => ({
      pageNumber: p.pageNumber,
      width: p.width,
      height: p.height,
      dpi: p.dpi,
    }));

    if (extraction && extraction.fields) {
      extraction.fields.forEach((f: ExtractedField, idx: number) => {
        const fieldVal = f.extractedValue !== null && f.extractedValue !== undefined ? String(f.extractedValue) : '';
        const fieldLabel = f.label || f.fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        
        let hasBoxes = false;
        let fieldPage = 1;

        if (f.evidence && !f.evidence.evidence_unmapped && f.evidence.boxes && f.evidence.boxes.length > 0) {
          hasBoxes = true;
          fieldPage = f.evidence.page || 1;
          for (let bIdx = 0; bIdx < f.evidence.boxes.length; bIdx++) {
            const b = f.evidence.boxes[bIdx];
            boundingBoxes.push({
              id: `box-${idx + 1}-${bIdx + 1}`,
              fieldKey: f.fieldName,
              label: fieldLabel,
              page: fieldPage,
              x: b.x,
              y: b.y,
              w: b.w,
              h: b.h,
              top: Number((b.y * 100).toFixed(2)),
              left: Number((b.x * 100).toFixed(2)),
              width: Number((b.w * 100).toFixed(2)),
              height: Number((b.h * 100).toFixed(2)),
              value: fieldVal,
              confidence: Math.round((f.confidence ?? 0.9) * 100),
            });
          }
        } else if (f.groundedEvidence && f.groundedEvidence.boundingBox) {
          hasBoxes = true;
          fieldPage = f.groundedEvidence.pageNumber || 1;
          const pageInfo = ocrResult?.pages?.find((p) => p.pageNumber === fieldPage);
          const pw = pageInfo?.width || 2550;
          const ph = pageInfo?.height || 3300;
          const normX = Math.max(0, Math.min(1, Number((f.groundedEvidence.boundingBox.left / pw).toFixed(6))));
          const normY = Math.max(0, Math.min(1, Number((f.groundedEvidence.boundingBox.top / ph).toFixed(6))));
          const normW = Math.max(0, Math.min(1, Number((f.groundedEvidence.boundingBox.width / pw).toFixed(6))));
          const normH = Math.max(0, Math.min(1, Number((f.groundedEvidence.boundingBox.height / ph).toFixed(6))));

          boundingBoxes.push({
            id: `box-${idx + 1}`,
            fieldKey: f.fieldName,
            label: fieldLabel,
            page: fieldPage,
            x: normX,
            y: normY,
            w: normW,
            h: normH,
            top: Number((normY * 100).toFixed(2)),
            left: Number((normX * 100).toFixed(2)),
            width: Number((normW * 100).toFixed(2)),
            height: Number((normH * 100).toFixed(2)),
            value: fieldVal,
            confidence: Math.round((f.confidence ?? 0.9) * 100),
          });
        }

        const isUnmapped = !hasBoxes || Boolean(f.evidence?.evidence_unmapped);

        fields.push({
          key: f.fieldName,
          fieldKey: f.fieldName,
          label: fieldLabel,
          value: fieldVal,
          originalValue: fieldVal,
          confidence: Math.round(f.confidence <= 1.0 ? f.confidence * 100 : f.confidence),
          status: f.status === 'EXTRACTED' && f.confidence >= 0.85 ? 'reviewer_confirmed' : 'ai_suggestion',
          page: fieldPage,
          isMandatory: true,
          evidence_unmapped: isUnmapped,
          evidence: f.evidence || {
            page: fieldPage,
            boxes: hasBoxes ? boundingBoxes.filter((b) => b.fieldKey === f.fieldName).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })) : [],
            text: fieldVal,
            evidence_unmapped: isUnmapped,
          },
          history: [],
        });
      });
    }

    // 6. Fetch corrections and audit logs
    const correctionsKey = `${tenantId}:${documentId}`;
    const corrections = this.inMemoryCorrections.get(correctionsKey) || [];
    const auditLogs = this.inMemoryAuditEvents.get(correctionsKey) || [];

    let overallConf = doc.confidenceScore || 0.85;
    if (extraction && extraction.fields && extraction.fields.length > 0) {
      const sum = extraction.fields.reduce((acc, f) => acc + (f.confidence || 0), 0);
      overallConf = sum / extraction.fields.length;
    }

    return {
      documentId: doc.documentId,
      documentTitle: doc.fileName || doc.documentId,
      documentType: doc.documentType || (extraction ? extraction.documentType : 'Unknown'),
      status: doc.status,
      stage: doc.stage || 'HITL_REVIEW_PENDING',
      pages: ocrResult ? ocrResult.pageCount : doc.pageCount || 1,
      pageDimensions,
      submittedAt: doc.uploadedAt ? new Date(doc.uploadedAt).toISOString() : new Date().toISOString(),
      overallConfidence: overallConf,
      fields,
      boundingBoxes,
      reconciliationResult: extraction ? extraction.validationSummary?.reconciliationResult : undefined,
      validationSummary: extraction ? extraction.validationSummary : undefined,
      corrections,
      auditLogs,
    };
  }

  /**
   * Applies an authorized reviewer correction to an extracted field (FR-008)
   */
  static async correctField(
    documentId: string,
    tenantId: string,
    fieldKey: string,
    payload: FieldCorrectionRequest,
    user: AuthenticatedUser
  ): Promise<{ field: any; reconciliationResult?: any }> {
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    if (doc.status === 'QUARANTINED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is quarantined and cannot be modified.`,
        403,
        'DOCUMENT_QUARANTINED'
      );
    }

    const extraction = await ExtractionService.getExtraction(documentId, tenantId);
    if (!extraction) {
      throw new DocumentNotEligibleError(
        `Extraction record for document '${documentId}' not found.`,
        404,
        'EXTRACTION_NOT_FOUND'
      );
    }

    const targetField = extraction.fields.find((f: ExtractedField) => f.fieldName === fieldKey);
    if (!targetField) {
      throw new DocumentNotEligibleError(
        `Field '${fieldKey}' not found in document extraction fields.`,
        400,
        'FIELD_NOT_FOUND'
      );
    }

    const originalValue = targetField.extractedValue;
    const correctedValue = payload.correctedValue;

    // Record correction
    const correction: FieldCorrection = {
      id: `CORR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentId,
      tenantId,
      fieldKey,
      originalValue,
      correctedValue,
      reviewerId: user.userId,
      reviewerName: user.email,
      reason: payload.reason || 'Human reviewer correction in Review Workbench',
      timestamp: new Date().toISOString(),
    };

    const corrKey = `${tenantId}:${documentId}`;
    const correctionsList = this.inMemoryCorrections.get(corrKey) || [];
    correctionsList.push(correction);
    this.inMemoryCorrections.set(corrKey, correctionsList);

    // Mutate field on extraction
    targetField.extractedValue = correctedValue;
    targetField.confidence = 1.0; // Manual human verification = 100%
    targetField.status = 'EXTRACTED';

    // If financial field, re-evaluate arithmetic reconciliation
    let reconciliationResult = extraction.validationSummary?.reconciliationResult;
    if (
      fieldKey === 'net_amount' ||
      fieldKey === 'tax_amount' ||
      fieldKey === 'total_amount'
    ) {
      const netVal = extraction.fields.find((f: ExtractedField) => f.fieldName === 'net_amount')?.extractedValue;
      const taxVal = extraction.fields.find((f: ExtractedField) => f.fieldName === 'tax_amount')?.extractedValue;
      const totVal = extraction.fields.find((f: ExtractedField) => f.fieldName === 'total_amount')?.extractedValue;

      const netNum = parseFloat(String(netVal ?? 0));
      const taxNum = parseFloat(String(taxVal ?? 0));
      const totNum = parseFloat(String(totVal ?? 0));

      reconciliationResult = reconcileInvoiceAmounts(netNum, taxNum, totNum);
      if (extraction.validationSummary) {
        extraction.validationSummary.reconciliationResult = reconciliationResult;
      }
    }

    // Persist to review_edits table if database mode
    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO review_edits (
             id, tenant_id, document_id, document_type, field_key, original_value, corrected_value, reviewer_id, reason, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            correction.id,
            tenantId,
            documentId,
            doc.documentType,
            fieldKey,
            String(originalValue ?? ''),
            String(correctedValue ?? ''),
            user.userId,
            payload.reason || 'Human reviewer correction in Review Workbench',
          ]
        );
      } catch (err: any) {
        Logger.warn({ message: `Database insert for review_edits failed: ${err.message}` });
      }
    }

    // Persist updated extraction
    await ExtractionService.saveExtractionResult(extraction);

    // Record audit event
    const auditEvent: ReviewAuditEvent = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentId,
      tenantId,
      action: 'FIELD_CORRECTION',
      actor: user.email,
      role: user.role,
      details: `Field '${fieldKey}' corrected from '${originalValue}' to '${correctedValue}'.`,
      timestamp: new Date().toISOString(),
      metadata: { fieldKey, originalValue, correctedValue, reason: payload.reason },
    };

    const auditList = this.inMemoryAuditEvents.get(corrKey) || [];
    auditList.push(auditEvent);
    this.inMemoryAuditEvents.set(corrKey, auditList);

    Logger.info({
      context: 'ReviewService',
      message: `Field '${fieldKey}' corrected for document ${documentId}`,
      data: { documentId, tenantId, fieldKey },
    });

    return { field: targetField, reconciliationResult };
  }

  /**
   * Submits a reviewer workflow transition decision (FR-008 & FR-009 / Part G)
   */
  static async submitReviewDecision(
    documentId: string,
    tenantId: string,
    payload: ReviewDecisionRequest,
    user: AuthenticatedUser
  ): Promise<{ status: string; stage: string; auditEvent: ReviewAuditEvent }> {
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    if (doc.status === 'QUARANTINED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is quarantined and cannot be transitioned.`,
        403,
        'DOCUMENT_QUARANTINED'
      );
    }

    // Part G: Server-side validation on review submit
    if (payload.action === 'APPROVE') {
      const extraction = await ExtractionService.getExtraction(documentId, tenantId);
      if (extraction) {
        const netVal = extraction.fields.find((f: ExtractedField) => f.fieldName === 'net_amount')?.extractedValue;
        const taxVal = extraction.fields.find((f: ExtractedField) => f.fieldName === 'tax_amount')?.extractedValue;
        const totVal = extraction.fields.find((f: ExtractedField) => f.fieldName === 'total_amount')?.extractedValue;

        if (netVal !== undefined && taxVal !== undefined && totVal !== undefined) {
          const netNum = parseFloat(String(netVal));
          const taxNum = parseFloat(String(taxVal));
          const totNum = parseFloat(String(totVal));
          const mathResult = reconcileInvoiceAmounts(netNum, taxNum, totNum);

          if (mathResult.status === 'MISMATCH') {
            const permittedRoles = ['Admin', 'org_admin', 'approver', 'Approver', 'FinanceHead'];
            const hasPermission =
              permittedRoles.includes(user.role) ||
              user.permissions?.includes('DOC_APPROVE') ||
              user.permissions?.includes('ADMIN_ACCESS');

            if (payload.overrideReason && hasPermission) {
              const overrideAuditEvent: ReviewAuditEvent = {
                id: `LOG-OVR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                documentId,
                tenantId,
                action: 'VALIDATION_OVERRIDE',
                actor: user.email,
                role: user.role,
                details: `Validation override approved by ${user.email} (${user.role}): ${payload.overrideReason}`,
                timestamp: new Date().toISOString(),
                metadata: {
                  reason: payload.overrideReason,
                  rule: 'INVOICE_TOTAL_MATH',
                  delta: mathResult.delta,
                  expectedTotal: mathResult.expectedTotal,
                  actualTotal: mathResult.totalAmount,
                },
              };
              const corrKey = `${tenantId}:${documentId}`;
              const auditList = this.inMemoryAuditEvents.get(corrKey) || [];
              auditList.push(overrideAuditEvent);
              this.inMemoryAuditEvents.set(corrKey, auditList);
            } else {
              throw new ReviewValidationError(
                `Invoice total mismatch: net_amount (${netNum}) + tax_amount (${taxNum}) = ${mathResult.expectedTotal}, but total_amount is ${totNum} (delta: ${mathResult.delta}). Approval blocked without authorized override reason.`,
                422,
                'INVOICE_TOTAL_MISMATCH',
                {
                  delta: mathResult.delta,
                  expectedTotal: mathResult.expectedTotal,
                  actualTotal: mathResult.totalAmount,
                }
              );
            }
          }
        }
      }
    }

    let newStatus: DocumentStatus = doc.status;
    let newStage = doc.stage;

    switch (payload.action) {
      case 'APPROVE':
        newStatus = 'APPROVED';
        newStage = 'REVIEW_COMPLETED';
        break;
      case 'REJECT':
        newStatus = 'REJECTED';
        newStage = 'REVIEW_REJECTED';
        break;
      case 'REQUEST_CHANGES':
        newStatus = 'NEEDS_REVIEW';
        newStage = 'CHANGES_REQUESTED';
        break;
      default:
        throw new DocumentNotEligibleError(
          `Invalid review action '${payload.action}'. Must be APPROVE, REJECT, or REQUEST_CHANGES.`,
          400,
          'INVALID_ACTION'
        );
    }

    await IntakeService.updateDocument(documentId, tenantId, {
      status: newStatus,
      stage: newStage,
    });

    const auditEvent: ReviewAuditEvent = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentId,
      tenantId,
      action: payload.action,
      actor: user.email,
      role: user.role,
      details: payload.comments || `Review workflow decision executed: ${payload.action}`,
      timestamp: new Date().toISOString(),
      metadata: { comments: payload.comments, previousStatus: doc.status, newStatus },
    };

    const corrKey = `${tenantId}:${documentId}`;
    const auditList = this.inMemoryAuditEvents.get(corrKey) || [];
    auditList.push(auditEvent);
    this.inMemoryAuditEvents.set(corrKey, auditList);

    // Update in-memory review task status if present
    const task = this.inMemoryTasks.get(`${tenantId}:${documentId}`);
    if (task) {
      task.status = payload.action === 'APPROVE' ? 'Approved' : payload.action === 'REJECT' ? 'Rejected' : 'Changes Requested';
    }

    // Trigger in-app notification (FR-020 / D.3)
    try {
      await NotificationService.dispatchNotification(tenantId, {
        userId: user.userId,
        type: payload.action === 'APPROVE' ? 'approval_decision' : 'returned_for_changes',
        category: 'approvals',
        title: `Review Decision: ${payload.action}`,
        message: `Document '${doc.fileName || documentId}' has been ${newStatus.toLowerCase()} by ${user.email}.`,
        entityId: documentId,
        payload: { documentId, action: payload.action, newStatus, newStage },
      });
    } catch {
      // Non-fatal notification error
    }

    Logger.info({
      context: 'ReviewService',
      message: `Review decision '${payload.action}' executed for document ${documentId}`,
      data: { documentId, tenantId, newStatus, newStage },
    });

    return { status: newStatus, stage: newStage, auditEvent };
  }

  /**
   * Retrieves audit logs for a document (FR-008)
   */
  static async getAuditLogs(documentId: string, tenantId: string): Promise<ReviewAuditEvent[]> {
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    const corrKey = `${tenantId}:${documentId}`;
    return this.inMemoryAuditEvents.get(corrKey) || [];
  }
}
