export const OUTBOX_EVENT_TYPES = [
  'DOCUMENT_UPLOADED',
  'DOCUMENT_PUBLISHED',
  'INDEX_DOCUMENT_REQUESTED',
  'OCR_COMPLETED',
  'EXTRACTION_REQUESTED',
  'WEBHOOK_REQUESTED',
  'DOCUMENT_RETRY_REQUESTED',
  'DOCUMENT_REPLACED',
  'DOCUMENT_SUMMARIZED',
  'EMAIL_ATTACHMENT_INGESTED',
  'DOCUMENT_PURGED',
  'AUDIT_LOG_RECORDED',
] as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

export type OutboxEventStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OutboxEventRecord {
  eventId: string;
  tenantId: string;
  documentId: string;
  eventType: OutboxEventType;
  payload: Record<string, any>;
  status: OutboxEventStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string | null;
  correlationId?: string | null;
  createdAt: Date;
  processingStartedAt?: Date | null;
  processedAt?: Date | null;
}
