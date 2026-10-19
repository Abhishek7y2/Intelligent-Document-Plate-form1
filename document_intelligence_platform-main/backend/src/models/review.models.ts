export type ReviewStatus = 'Pending Review' | 'In Progress' | 'Changes Requested' | 'Reviewed' | 'Approved' | 'Rejected';

export type ReviewPriority = 'High' | 'Medium' | 'Low';

export interface ReviewTask {
  id: string;
  docId: string;
  tenantId: string;
  documentTitle: string;
  assignee: string;
  slaHoursLeft: number;
  status: ReviewStatus;
  priority: ReviewPriority;
  confidence: number;
  pages: number;
  submittedAt: string;
  type: string;
}

export interface FieldCorrection {
  id: string;
  documentId: string;
  tenantId: string;
  fieldKey: string;
  originalValue: any;
  correctedValue: any;
  reviewerId: string;
  reviewerName?: string;
  reason?: string;
  timestamp: string;
}

export interface ReviewAuditEvent {
  id: string;
  documentId: string;
  tenantId: string;
  action: 'SESSION_START' | 'FIELD_CORRECTION' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'VALIDATION_OVERRIDE';
  actor: string;
  role: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface FieldCorrectionRequest {
  correctedValue: any;
  reason?: string;
}

export interface ReviewDecisionRequest {
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  comments?: string;
  overrideReason?: string;
}

export interface ReviewWorkbenchData {
  documentId: string;
  documentTitle: string;
  documentType: string;
  status: string;
  stage: string;
  pages: number;
  submittedAt: string;
  overallConfidence: number;
  fields: any[];
  boundingBoxes: any[];
  pageDimensions?: Array<{ pageNumber: number; width: number; height: number; dpi?: number }>;
  reconciliationResult?: any;
  validationSummary?: any;
  corrections: FieldCorrection[];
  auditLogs: ReviewAuditEvent[];
}
