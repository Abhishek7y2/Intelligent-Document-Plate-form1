import { Injectable, signal, computed, inject } from '@angular/core';
import { INotificationService, NOTIFICATION_SERVICE_TOKEN } from './api-services';
import { MockSettingsService } from './mock-settings.service';
import { ApiClient } from '../api/api-client';

export type NotificationType =
  | 'receipt'
  | 'processing_exception'
  | 'review_assignment'
  | 'returned_for_changes'
  | 'approval_decision'
  | 'retention_expiry'
  | 'sla_breach';

export type NotificationCategory = 'tasks' | 'approvals' | 'failures' | 'expiry';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'error' | 'success';
  targetUrl: string;
  entityId?: string;
}

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  email: boolean;
  inApp: boolean;
  requiredInApp?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements INotificationService {
  private readonly mockSettings = inject(MockSettingsService, { optional: true });
  private readonly api = inject(ApiClient, { optional: true });

  readonly isDrawerOpen = signal(false);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  readonly notifications = signal<NotificationItem[]>([
    {
      id: 'NOTIF-101',
      type: 'sla_breach',
      category: 'failures',
      title: 'SLA Warning Threshold Breach',
      message: 'DOC-10247 (INV-78421) requires review within 3.5 hours to avoid SLA breach.',
      timestamp: '10 min ago',
      read: false,
      severity: 'error',
      targetUrl: '/review/DOC-10247',
      entityId: 'DOC-10247',
    },
    {
      id: 'NOTIF-102',
      type: 'review_assignment',
      category: 'tasks',
      title: 'New Review Task Assigned',
      message: 'You have been assigned to verify OCR extractions for Supplier Master Agreement.',
      timestamp: '25 min ago',
      read: false,
      severity: 'info',
      targetUrl: '/review/DOC-10248',
      entityId: 'DOC-10248',
    },
    {
      id: 'NOTIF-103',
      type: 'approval_decision',
      category: 'approvals',
      title: 'Document Approved by Finance',
      message: 'Purchase Order PO-2026-9842 has been approved by Priya Mehta.',
      timestamp: '1 hour ago',
      read: false,
      severity: 'success',
      targetUrl: '/approvals',
      entityId: 'DOC-10245',
    },
    {
      id: 'NOTIF-104',
      type: 'processing_exception',
      category: 'failures',
      title: 'Low OCR Confidence Exception',
      message: 'Scanned receipt PDF Page 2 resolution is below 150 DPI threshold.',
      timestamp: '2 hours ago',
      read: true,
      severity: 'warning',
      targetUrl: '/intake',
      entityId: 'ERR-901',
    },
    {
      id: 'NOTIF-105',
      type: 'returned_for_changes',
      category: 'tasks',
      title: 'Changes Requested on Invoice',
      message: 'Rahul Sharma requested arithmetic reconciliation on invoice total.',
      timestamp: '3 hours ago',
      read: false,
      severity: 'warning',
      targetUrl: '/review/DOC-10247',
      entityId: 'DOC-10247',
    },
    {
      id: 'NOTIF-106',
      type: 'retention_expiry',
      category: 'expiry',
      title: 'Retention Schedule Expiry Alert',
      message: 'Vendor agreement DOC-09812 is scheduled for automatic purge in 14 days.',
      timestamp: '1 day ago',
      read: true,
      severity: 'info',
      targetUrl: '/documents/DOC-10248',
      entityId: 'DOC-09812',
    },
    {
      id: 'NOTIF-107',
      type: 'receipt',
      category: 'tasks',
      title: 'Document Batch Ingested',
      message: 'Batch upload of 4 invoices completed with 98.4% average OCR confidence.',
      timestamp: '1 day ago',
      read: true,
      severity: 'success',
      targetUrl: '/documents',
      entityId: 'BAT-2026-04',
    },
  ]);

  readonly preferences = signal<NotificationPreference[]>([
    { type: 'receipt', label: 'Document Intake Receipt', email: true, inApp: true },
    { type: 'processing_exception', label: 'OCR & Processing Exceptions', email: true, inApp: true, requiredInApp: true },
    { type: 'review_assignment', label: 'Review Task Assignments', email: true, inApp: true },
    { type: 'returned_for_changes', label: 'Returned for Changes', email: true, inApp: true },
    { type: 'approval_decision', label: 'Approval & Rejection Decisions', email: true, inApp: true },
    { type: 'retention_expiry', label: 'Retention Policy Expiry Alerts', email: false, inApp: true },
    { type: 'sla_breach', label: 'SLA Breach Warnings', email: true, inApp: true, requiredInApp: true },
  ]);

  readonly unreadCount = computed(() => {
    return this.notifications().filter((item) => !item.read).length;
  });

  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private pollTimer: any = null;
  private reconnectAttempts = 0;
  private readonly maxSseRetries = 3;

  loadNotifications(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    if (this.api) {
      this.api.get<{ notifications: any[] }>('/notifications').subscribe({
        next: (res) => {
          if (res?.notifications && res.notifications.length > 0) {
            const mapped: NotificationItem[] = res.notifications.map((n: any) => ({
              id: n.id,
              type: n.type,
              category: n.category || 'tasks',
              title: n.title,
              message: n.message,
              timestamp: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: n.read,
              severity: n.severity || 'info',
              targetUrl: n.targetUrl || '/documents',
              entityId: n.entityId,
            }));
            this.notifications.set(mapped);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });

      // Initialize real-time SSE stream with single-use ticket
      this.initRealtimeStream();
    } else {
      setTimeout(() => {
        this.isLoading.set(false);
      }, 400);
    }
  }

  /**
   * Requests a 60s single-use stream ticket and opens an SSE connection (Part E.2)
   * Note: The ticket is never logged.
   */
  initRealtimeStream(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined' || !this.api) {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.api.post<{ ticket: string }>('/notifications/stream-ticket', {}).subscribe({
      next: (res) => {
        const ticket = res?.ticket;
        if (!ticket) {
          this.handleStreamFailure();
          return;
        }

        try {
          this.eventSource = new EventSource(`/api/v1/notifications/stream?ticket=${encodeURIComponent(ticket)}`);

          this.eventSource.onopen = () => {
            this.reconnectAttempts = 0;
            if (this.pollTimer) {
              clearInterval(this.pollTimer);
              this.pollTimer = null;
            }
          };

          this.eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data?.notification) {
                const n = data.notification;
                const newItem: NotificationItem = {
                  id: n.id || `NOTIF-${Date.now()}`,
                  type: n.type || 'review_assignment',
                  category: n.category || 'tasks',
                  title: n.title || 'Notification',
                  message: n.message || '',
                  timestamp: 'Just now',
                  read: false,
                  severity: n.severity || 'info',
                  targetUrl: n.targetUrl || '/documents',
                  entityId: n.entityId,
                };
                this.notifications.update((list) => [newItem, ...list]);
              }
            } catch {
              // Ignore ping or malformed event
            }
          };

          this.eventSource.onerror = () => {
            this.handleStreamFailure();
          };
        } catch {
          this.handleStreamFailure();
        }
      },
      error: () => {
        this.handleStreamFailure();
      },
    });
  }

  private handleStreamFailure(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxSseRetries) {
      // Fallback to polling if SSE repeatedly fails
      this.startPollingFallback();
      return;
    }

    // Exponential backoff with fresh ticket request
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      this.initRealtimeStream();
    }, delay);
  }

  private startPollingFallback(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.api) return;
      this.api.get<{ notifications: any[] }>('/notifications').subscribe({
        next: (res) => {
          if (res?.notifications && res.notifications.length > 0) {
            const mapped: NotificationItem[] = res.notifications.map((n: any) => ({
              id: n.id,
              type: n.type,
              category: n.category || 'tasks',
              title: n.title,
              message: n.message,
              timestamp: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: n.read,
              severity: n.severity || 'info',
              targetUrl: n.targetUrl || '/documents',
              entityId: n.entityId,
            }));
            this.notifications.set(mapped);
          }
        },
      });
    }, 15000);
  }

  closeRealtimeStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  toggleDrawer(): void {
    this.isDrawerOpen.set(!this.isDrawerOpen());
  }

  openDrawer(): void {
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  markAsRead(id: string): void {
    this.notifications.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    if (this.api) {
      this.api.patch(`/notifications/${id}/read`, {}).subscribe({ error: () => {} });
    }
  }

  markAllAsRead(): void {
    this.notifications.update((list) =>
      list.map((item) => ({ ...item, read: true })),
    );
    if (this.api) {
      this.api.post('/notifications/read-all', {}).subscribe({ error: () => {} });
    }
  }

  toggleRead(id: string): void {
    this.notifications.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: !item.read } : item)),
    );
  }

  toggleEmailPref(type: NotificationType): void {
    this.preferences.update((list) =>
      list.map((p) => (p.type === type ? { ...p, email: !p.email } : p)),
    );
  }

  toggleInAppPref(type: NotificationType): void {
    this.preferences.update((list) =>
      list.map((p) => {
        if (p.type === type) {
          if (p.requiredInApp || type === 'processing_exception' || type === 'sla_breach') {
            return p; // Non-disableable for critical types
          }
          return { ...p, inApp: !p.inApp };
        }
        return p;
      }),
    );
  }

  getNotificationTypeLabel(type: NotificationType): string {
    switch (type) {
      case 'receipt': return 'Intake Receipt';
      case 'processing_exception': return 'Processing Exception';
      case 'review_assignment': return 'Review Assignment';
      case 'returned_for_changes': return 'Returned for Changes';
      case 'approval_decision': return 'Approval Decision';
      case 'retention_expiry': return 'Retention Expiry';
      case 'sla_breach': return 'SLA Breach';
    }
  }
}

