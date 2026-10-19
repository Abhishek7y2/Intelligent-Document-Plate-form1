export type WebhookDeliveryStatus = 'PENDING' | 'SUCCESS' | 'RETRYING' | 'FAILED' | 'DEAD_LETTER';

export interface WebhookSubscriptionRecord {
  id: string;
  tenantId: string;
  name: string;
  targetUrl: string;
  secretHash: string;
  secretPreview: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookSubscriptionPayload {
  name: string;
  targetUrl: string;
  subscribedEvents: string[];
}

export interface WebhookDeliveryRecord {
  id: string;
  subscriptionId: string;
  tenantId: string;
  eventId: string;
  eventType: string;
  payloadSnapshot: Record<string, any>;
  signatureHeader: string;
  timestampHeader: string;
  attemptNumber: number;
  status: WebhookDeliveryStatus;
  httpStatusCode?: number;
  responseBodySnippet?: string;
  errorMessage?: string;
  nextRetryAt?: Date;
  durationMs: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  tenantId: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface WebhookSignatureVerification {
  valid: boolean;
  reason?: string;
}
