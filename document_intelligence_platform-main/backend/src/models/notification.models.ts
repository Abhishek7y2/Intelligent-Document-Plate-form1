export type NotificationType =
  | 'receipt'
  | 'processing_exception'
  | 'review_assignment'
  | 'returned_for_changes'
  | 'approval_decision'
  | 'retention_expiry'
  | 'sla_breach'
  | 'task_assigned'
  | 'review_requested'
  | 'approval_requested'
  | 'processing_failed'
  | 'export_ready'
  | 'document_expiring';

export type NotificationCategory = 'tasks' | 'approvals' | 'failures' | 'expiry' | 'general';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export type DeliveryStatus = 'QUEUED' | 'DELIVERED' | 'RETRYING' | 'FAILED';

export type DeliveryChannel = 'in_app' | 'email' | 'both';

export interface NotificationRecord {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  payload?: Record<string, any>;
  severity: NotificationSeverity;
  targetUrl?: string;
  entityId?: string;
  read: boolean;
  deliveryChannel: DeliveryChannel;
  deliveryStatus: DeliveryStatus;
  deliveryAttempts: number;
  errorMessage?: string;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationPreferenceRecord {
  id: string;
  tenantId: string;
  userId: string;
  notificationType: NotificationType;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  updatedAt: Date;
}

export interface DispatchNotificationPayload {
  userId: string;
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  payload?: Record<string, any>;
  severity?: NotificationSeverity;
  targetUrl?: string;
  entityId?: string;
  channel?: DeliveryChannel;
}

export interface NotificationFilters {
  category?: NotificationCategory;
  readOnly?: boolean;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}
