export type DocumentStatus =
  | 'PENDING_SCAN'
  | 'QUARANTINED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'STP_PROCESSED'
  | 'NEEDS_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'FAILED'
  | 'DELETION_PENDING'
  | 'PURGED';

export type IngestionSource =
  | 'MANUAL_UPLOAD'
  | 'EMAIL_INGEST'
  | 'API_CONNECTOR'
  | 'S3_WATCHER'
  | 'MOBILE_SCANNER';

export interface DocumentRecord {
  documentId: string;
  tenantId: string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  documentType: string;
  status: DocumentStatus;
  stage: string;
  confidenceScore: number | null;
  slaStatus: 'ON_TRACK' | 'WARNING' | 'BREACHED';
  slaDeadline?: Date | null;
  ingestionSource: IngestionSource;
  assignedTo?: string | null;
  pageCount: number;
  uploadedAt: Date;
  processedAt?: Date | null;
  completedAt?: Date | null;
  quarantineReason?: string | null;
  scannedAt?: Date | null;
  retryCount?: number;
  lastError?: string | null;
}

export interface DocumentProcessingAttempt {
  id: string;
  documentId: string;
  tenantId: string;
  stage: string;
  attemptNumber: number;
  succeeded: boolean;
  error?: string | null;
  correlationId?: string | null;
  createdAt: Date;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  tenantId: string;
  versionNo: number;
  storageKey: string;
  sha256Hash: string;
  isCurrent: boolean;
  createdBy?: string | null;
  createdAt: Date;
}

export interface FileValidationResult {
  valid: boolean;
  mimeType: string;
  detectedExtension: string;
  sha256Hash: string;
  sizeBytes: number;
  error?: string;
}

export interface MalwareScanResult {
  clean: boolean;
  threatName?: string;
  scanner: string;
  scannedAt: Date;
  details?: Record<string, any>;
}

export interface UploadSuccessResponse {
  documentId: string;
  fileName: string;
  sha256Hash: string;
  fileSizeBytes: number;
  mimeType: string;
  documentType: string;
  status: DocumentStatus;
  stage: string;
  uploadedAt: string;
}
