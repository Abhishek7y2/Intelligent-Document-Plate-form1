export type RetentionAction = 'purge' | 'archive' | 'review';
export type RetentionPolicyStatus = 'ACTIVE' | 'DRAFT' | 'SUPERSEDED' | 'ARCHIVED';
export type LegalHoldStatus = 'ACTIVE' | 'RELEASED';

export type DeletionCaseStatus = 
  | 'REQUESTED' 
  | 'APPROVED' 
  | 'HOLD_CHECK' 
  | 'ACCESS_REVOKED' 
  | 'DERIVED_DATA_REMOVED' 
  | 'FILES_DELETED' 
  | 'COMPLETED' 
  | 'EXCEPTION' 
  | 'PAUSED_BY_LEGAL_HOLD';

export interface PurgeEvidence {
  binariesDeleted: boolean;
  ocrTextDeleted: boolean;
  extractionRecordsPurged: boolean;
  vectorsSnippetsPurged: boolean;
  cachesCleared: boolean;
  exportsPurged: boolean;
  backupsPurged: boolean;
  stores?: Record<string, { status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'BLOCKED_BY_HOLD'; timestamp: string; details?: any }>;
}

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  documentType: string;
  retentionPeriodYears: number;
  triggerEvent: string;
  actionAfterExpiry: RetentionAction;
  version: string;
  status: RetentionPolicyStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalHold {
  id: string;
  tenantId: string;
  matterName: string;
  matterNumber: string;
  reason: string;
  scopeDocumentIds: string[];
  scopeDocumentType?: string;
  status: LegalHoldStatus;
  placedBy: string;
  placedAt: string;
  releasedBy?: string;
  releasedAt?: string;
  releaseReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeletionCase {
  id: string;
  tenantId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  sourceVersion: string;
  retentionPolicyId?: string;
  legalBasis: string;
  status: DeletionCaseStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  holdCheckPassed: boolean;
  holdCheckedAt?: string;
  activeHoldId?: string;
  completedAt?: string;
  evidence: PurgeEvidence;
  purgeSignatureHash?: string;
  correlationId?: string;
  errorMessage?: string;
  retryCount?: number;
  lastAttemptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurgeAuditLedgerEntry {
  id: string;
  tenantId: string;
  caseId: string;
  documentId: string;
  storeTarget: string;
  operationType: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED_BY_HOLD' | 'SKIPPED_BY_POLICY';
  durationMs: number;
  details: Record<string, any>;
  sha256Seal: string;
  executedAt: string;
}
