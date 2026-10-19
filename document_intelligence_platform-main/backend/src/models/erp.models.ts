export type ErpTarget = 'SAP_S4HANA' | 'NETSUITE' | 'SALESFORCE';

export type ErpPublicationStatus = 'PENDING' | 'DISPATCHING' | 'PUBLISHED' | 'FAILED' | 'RETRYING';

export type ErpFailureCategory = 'TIMEOUT' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNAUTHENTICATED';

export interface ErpDocumentHeader {
  documentId: string;
  documentType: string;
  sha256Hash: string;
  version: string;
  approvedAt: string;
  monetaryAmount: number | null;
  currency: string;
}

export interface ErpApprovalSignature {
  approverId: string;
  approverName: string;
  role: string;
  timestamp: string;
  signatureHash: string;
}

export interface ErpPublishPayload {
  eventId: string;
  eventType: 'document.published';
  timestamp: string;
  tenantId: string;
  header: ErpDocumentHeader;
  fields: Record<string, any>;
  approvalChain: ErpApprovalSignature[];
}

export interface ErpPublicationRecord {
  publicationId: string;
  documentId: string;
  tenantId: string;
  erpTarget: ErpTarget;
  idempotencyKey: string;
  status: ErpPublicationStatus;
  attempts: number;
  httpStatusCode?: number;
  failureCategory?: ErpFailureCategory;
  lastError?: string;
  payload: ErpPublishPayload;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErpPublishResponse {
  success: boolean;
  publicationId: string;
  status: ErpPublicationStatus;
  attempts: number;
  idempotencyKey: string;
  publishedAt?: string;
  error?: string;
}
