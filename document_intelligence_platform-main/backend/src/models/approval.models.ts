export type ApprovalTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export type ApprovalRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'RETURNED';

export type ApprovalAction = 'APPROVE' | 'REJECT' | 'RETURN_FOR_CHANGES';

export interface ApprovalDecision {
  id: string;
  requestId: string;
  documentId: string;
  tenantId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  decision: ApprovalAction;
  reasonCode: string;
  comments?: string;
  signatureHash: string;
  sourceVersion: string;
  timestamp: string;
}

export interface ApprovalRequest {
  id: string;
  documentId: string;
  tenantId: string;
  status: ApprovalRequestStatus;
  tier: ApprovalTier;
  monetaryAmount: number | null;
  currency: string;
  requiredApprovals: number;
  approvedCount: number;
  sourceVersion: string;
  submittedBy: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
  decisions: ApprovalDecision[];
}

export interface ApprovalDecisionPayload {
  action: ApprovalAction;
  reasonCode: string;
  comments?: string;
  sourceVersion?: string;
}

export interface ApprovalQueueItem {
  id: string;
  documentId: string;
  tenantId: string;
  documentTitle: string;
  documentType: string;
  tier: ApprovalTier;
  amount: number | null;
  currency: string;
  submittedBy: string;
  reviewedBy?: string;
  status: ApprovalRequestStatus;
  requiredApprovals: number;
  approvedCount: number;
  priority: 'High' | 'Medium' | 'Low';
  submittedAt: string;
  sourceVersion: string;
}

export interface ApprovalGateStatus {
  allRequiredFieldsComplete: boolean;
  blockingExceptionsResolved: boolean;
  sourceVersionCurrent: boolean;
  missingFieldsCount: number;
  unresolvedExceptionsCount: number;
  gateSatisfied: boolean;
  gateMessage: string;
}
