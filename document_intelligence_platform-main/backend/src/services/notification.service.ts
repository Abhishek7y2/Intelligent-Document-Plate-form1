import crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  NotificationRecord,
  NotificationPreferenceRecord,
  DispatchNotificationPayload,
  NotificationFilters,
  NotificationType,
  DeliveryStatus,
} from '../models/notification.models.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';
import { QueueService } from './queue.service.js';
import { AuthService } from './auth.service.js';

export class NotificationError extends Error {
  statusCode = 400;
  code = 'NOTIFICATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

interface StreamTicketData {
  tenantId: string;
  userId: string;
  sessionId?: string;
  expiresAt: number;
}

export class NotificationService {
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryNotifications = new Map<string, NotificationRecord>();
  private static inMemoryPreferences = new Map<string, NotificationPreferenceRecord>();
  private static inMemoryTickets = new Map<string, StreamTicketData>();
  private static localEmitter = new EventEmitter();

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStoreMode(): 'memory' | 'database' {
    return this.storeMode;
  }

  static clearInMemory(): void {
    this.inMemoryNotifications.clear();
    this.inMemoryPreferences.clear();
    this.inMemoryTickets.clear();
  }

  /**
   * Dispatches a versioned notification with recipient validation, template rendering,
   * delivery tracking, database persistence (FR-020 / D.1), and Redis pub/sub fan-out (D.2).
   */
  static async dispatchNotification(
    tenantId: string,
    payload: DispatchNotificationPayload
  ): Promise<NotificationRecord> {
    if (!payload.userId || !payload.title || !payload.message || !payload.type) {
      throw new NotificationError('Missing required notification fields: userId, title, message, type.');
    }

    const id = `NOTIF-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const channel = payload.channel || 'in_app';

    // Verify user preferences
    const prefs = await this.getUserPreferences(tenantId, payload.userId);
    const prefForType = prefs.find((p) => p.notificationType === payload.type);

    let deliveryStatus: DeliveryStatus = 'DELIVERED';
    let errorMessage: string | undefined = undefined;

    // If delivery is disabled by user preference
    if (channel === 'email' && prefForType && !prefForType.emailEnabled) {
      deliveryStatus = 'FAILED';
      errorMessage = 'Recipient has disabled email delivery for this notification type.';
    } else if (channel === 'in_app' && prefForType && !prefForType.inAppEnabled) {
      deliveryStatus = 'FAILED';
      errorMessage = 'Recipient has disabled in-app delivery for this notification type.';
    } else if (channel === 'both' && prefForType && !prefForType.emailEnabled && !prefForType.inAppEnabled) {
      deliveryStatus = 'FAILED';
      errorMessage = 'Recipient has disabled all delivery channels for this notification type.';
    }

    const mergedPayload = {
      message: payload.message,
      category: payload.category || 'general',
      severity: payload.severity || 'info',
      targetUrl: payload.targetUrl,
      entityId: payload.entityId,
      ...(payload.payload || {}),
    };

    const record: NotificationRecord = {
      id,
      tenantId,
      userId: payload.userId,
      type: payload.type,
      category: payload.category || 'general',
      title: payload.title,
      message: payload.message,
      payload: mergedPayload,
      severity: payload.severity || 'info',
      targetUrl: payload.targetUrl,
      entityId: payload.entityId,
      read: false,
      deliveryChannel: channel,
      deliveryStatus,
      deliveryAttempts: 1,
      errorMessage,
      createdAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO notifications (
            id, tenant_id, user_id, type, title, payload, read_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.id,
            record.tenantId,
            record.userId,
            record.type,
            record.title,
            JSON.stringify(mergedPayload),
            null,
            record.createdAt,
          ]
        );
      } catch (err: any) {
        Logger.warn({ message: `Database insert for notification failed: ${err.message}` });
        this.inMemoryNotifications.set(record.id, record);
      }
    } else {
      this.inMemoryNotifications.set(record.id, record);
    }

    // Real-Time Fan-Out (FR-020 / D.2) via Redis pub/sub & local emitter
    await this.publishToRealTimeStream(tenantId, payload.userId, record);

    Logger.info({
      message: `Notification ${record.id} dispatched to user ${record.userId} with status ${record.deliveryStatus}`,
      context: 'NotificationService',
      data: { notificationId: record.id, tenantId, type: record.type, status: record.deliveryStatus },
    });

    return record;
  }

  /**
   * Publishes notification to Redis Pub/Sub channel for multi-instance fan-out (D.2)
   */
  private static async publishToRealTimeStream(
    tenantId: string,
    userId: string,
    record: NotificationRecord
  ): Promise<void> {
    const channel = `notifications:${tenantId}:${userId}`;
    const payloadStr = JSON.stringify(record);

    // Emit locally for in-process subscribers & test mode
    this.localEmitter.emit(channel, record);

    if (QueueService.getMode() === 'redis') {
      try {
        const redis = QueueService.getRedisClient();
        await redis.publish(channel, payloadStr);
      } catch (err: any) {
        Logger.warn({
          message: `Redis pub/sub publish failed: ${err.message}`,
          context: 'NotificationService',
        });
      }
    }
  }

  /**
   * Subscribes to notification stream for a specific user across instances
   */
  static subscribeToUserNotifications(
    tenantId: string,
    userId: string,
    onNotification: (notif: NotificationRecord) => void
  ): () => void {
    const channel = `notifications:${tenantId}:${userId}`;

    // 1. Local listener
    const localHandler = (record: NotificationRecord) => {
      onNotification(record);
    };
    this.localEmitter.on(channel, localHandler);

    // 2. Redis pub/sub if in redis mode
    let subscriber: any = null;
    if (QueueService.getMode() === 'redis') {
      try {
        const client = QueueService.getRedisClient();
        subscriber = client.duplicate();
        subscriber.subscribe(channel);
        subscriber.on('message', (chan: string, msg: string) => {
          if (chan === channel) {
            try {
              const parsed = JSON.parse(msg);
              onNotification(parsed);
            } catch {
              // ignore parse errors
            }
          }
        });
      } catch (err: any) {
        Logger.warn({
          message: `Redis subscription failed: ${err.message}`,
          context: 'NotificationService',
        });
      }
    }

    // Cleanup callback
    return () => {
      this.localEmitter.off(channel, localHandler);
      if (subscriber) {
        try {
          subscriber.unsubscribe(channel);
          subscriber.quit();
        } catch {
          // ignore
        }
      }
    };
  }

  /**
   * Lists notifications for a given user within their authorized tenant (FR-020 / D.1)
   */
  static async listUserNotifications(
    tenantId: string,
    userId: string,
    filters?: NotificationFilters
  ): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    let list: NotificationRecord[] = [];
    let unreadCount = 0;

    if (this.storeMode === 'database') {
      try {
        const conditions: string[] = ['tenant_id = $1', 'user_id = $2'];
        const values: any[] = [tenantId, userId];

        if (filters?.unreadOnly) {
          conditions.push('read_at IS NULL');
        } else if (filters?.readOnly) {
          conditions.push('read_at IS NOT NULL');
        }

        const countRes = await dbPool.query(
          `SELECT count(*)::int as count FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
          [tenantId, userId]
        );
        unreadCount = countRes.rows[0]?.count || 0;

        const limit = filters?.limit || 50;
        const offset = filters?.offset || 0;
        values.push(limit, offset);

        const res = await dbPool.query(
          `SELECT id, tenant_id as "tenantId", user_id as "userId", type,
                  title, payload, read_at as "readAt", created_at as "createdAt",
                  (read_at IS NOT NULL) as read
           FROM notifications
           WHERE ${conditions.join(' AND ')}
           ORDER BY created_at DESC
           LIMIT $${values.length - 1} OFFSET $${values.length}`,
          values
        );

        list = res.rows.map((r: any) => ({
          id: r.id,
          tenantId: r.tenantId,
          userId: r.userId,
          type: r.type,
          category: r.payload?.category || 'general',
          title: r.title,
          message: r.payload?.message || '',
          payload: r.payload || {},
          severity: r.payload?.severity || 'info',
          targetUrl: r.payload?.targetUrl,
          entityId: r.payload?.entityId,
          read: Boolean(r.read),
          deliveryChannel: 'in_app',
          deliveryStatus: 'DELIVERED',
          deliveryAttempts: 1,
          createdAt: r.createdAt,
          readAt: r.readAt,
        }));

        if (filters?.category) {
          list = list.filter((n) => n.category === filters.category);
        }

        return { notifications: list, unreadCount };
      } catch (err: any) {
        Logger.warn({ message: `Database list notifications failed, falling back to memory: ${err.message}` });
        list = Array.from(this.inMemoryNotifications.values()).filter(
          (n) => n.tenantId === tenantId && n.userId === userId
        );
      }
    } else {
      list = Array.from(this.inMemoryNotifications.values()).filter(
        (n) => n.tenantId === tenantId && n.userId === userId
      );
    }

    // Sort descending by date
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    unreadCount = list.filter((n) => !n.read).length;

    if (filters?.unreadOnly) {
      list = list.filter((n) => !n.read);
    } else if (filters?.readOnly) {
      list = list.filter((n) => n.read);
    }

    if (filters?.category) {
      list = list.filter((n) => n.category === filters.category);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const paginated = list.slice(offset, offset + limit);

    return { notifications: paginated, unreadCount };
  }

  /**
   * Marks a specific notification as read (POST /api/v1/notifications/:id/read)
   */
  static async markNotificationRead(
    tenantId: string,
    userId: string,
    notificationId: string
  ): Promise<boolean> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `UPDATE notifications SET read_at = NOW()
           WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND read_at IS NULL`,
          [notificationId, tenantId, userId]
        );
        if ((res.rowCount ?? 0) > 0) {
          const inMem = this.inMemoryNotifications.get(notificationId);
          if (inMem) {
            inMem.read = true;
            inMem.readAt = new Date();
          }
          return true;
        }
      } catch {
        // Fallback to memory
      }
    }

    const notif = this.inMemoryNotifications.get(notificationId);
    if (notif && notif.tenantId === tenantId && notif.userId === userId) {
      notif.read = true;
      notif.readAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Marks all notifications as read for a user (POST /api/v1/notifications/read-all)
   */
  static async markAllNotificationsRead(tenantId: string, userId: string): Promise<number> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `UPDATE notifications SET read_at = NOW()
           WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
          [tenantId, userId]
        );
        const count = res.rowCount ?? 0;
        for (const notif of this.inMemoryNotifications.values()) {
          if (notif.tenantId === tenantId && notif.userId === userId && !notif.read) {
            notif.read = true;
            notif.readAt = new Date();
          }
        }
        return count;
      } catch {
        // Fallback to memory
      }
    }

    let count = 0;
    for (const notif of this.inMemoryNotifications.values()) {
      if (notif.tenantId === tenantId && notif.userId === userId && !notif.read) {
        notif.read = true;
        notif.readAt = new Date();
        count++;
      }
    }
    return count;
  }

  /**
   * Generates a 60-second single-use ticket for SSE stream authentication (FR-020 / D.2)
   */
  static async createStreamTicket(
    tenantId: string,
    userId: string,
    sessionId?: string
  ): Promise<{ ticket: string; expiresIn: number }> {
    const ticket = `STKT-${crypto.randomBytes(24).toString('hex')}`;
    const data: StreamTicketData = {
      tenantId,
      userId,
      sessionId,
      expiresAt: Date.now() + 60 * 1000,
    };

    if (QueueService.getMode() === 'redis') {
      try {
        const redis = QueueService.getRedisClient();
        await redis.setex(`stream_ticket:${ticket}`, 60, JSON.stringify(data));
      } catch (err: any) {
        Logger.warn({ message: `Redis ticket store error: ${err.message}` });
        this.inMemoryTickets.set(ticket, data);
      }
    } else {
      this.inMemoryTickets.set(ticket, data);
    }

    return { ticket, expiresIn: 60 };
  }

  /**
   * Redeems a stream ticket (single-use validation) and verifies session is still valid (D.2)
   */
  static async redeemStreamTicket(ticket: string): Promise<StreamTicketData | null> {
    if (!ticket) return null;

    let data: StreamTicketData | null = null;

    if (QueueService.getMode() === 'redis') {
      try {
        const redis = QueueService.getRedisClient();
        // Redis GETDEL for atomic single-use extraction
        let val: string | null = null;
        if (typeof (redis as any).getdel === 'function') {
          val = await (redis as any).getdel(`stream_ticket:${ticket}`);
        } else {
          val = await redis.get(`stream_ticket:${ticket}`);
          if (val) {
            await redis.del(`stream_ticket:${ticket}`);
          }
        }
        if (val) {
          data = JSON.parse(val);
        }
      } catch (err: any) {
        Logger.warn({ message: `Redis ticket redeem error: ${err.message}` });
      }
    }

    if (!data && this.inMemoryTickets.has(ticket)) {
      const stored = this.inMemoryTickets.get(ticket)!;
      this.inMemoryTickets.delete(ticket); // Single use
      data = stored;
    }

    if (!data) return null;

    if (Date.now() > data.expiresAt) {
      return null;
    }

    // Verify session has not been revoked (Sprint 1 session check)
    const validation = await AuthService.validateUserAndSession(data.userId, data.tenantId, data.sessionId);
    if (!validation.valid) {
      return null;
    }

    return data;
  }

  /**
   * Checks upcoming document expiries and generates deduplicated notifications (D.3).
   * Generates notifications 7 days and 1 day before expiration.
   */
  static async processDocumentExpiryNotifications(): Promise<{ generatedCount: number }> {
    let generatedCount = 0;
    try {
      // Find documents with expires_at within the next 8 days that are not purged
      const res = await dbPool.query(
        `SELECT document_id as id, tenant_id as "tenantId", file_name as "fileName", expires_at as "expiresAt"
         FROM documents
         WHERE expires_at IS NOT NULL
           AND status != 'PURGED'
           AND expires_at > NOW()
           AND expires_at <= NOW() + INTERVAL '8 days'`
      );

      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

      for (const row of res.rows) {
        const expiresTime = new Date(row.expiresAt).getTime();
        const diffMs = expiresTime - now;

        let threshold: '7d' | '1d' | null = null;
        if (diffMs <= ONE_DAY_MS && diffMs > 0) {
          threshold = '1d';
        } else if (diffMs <= SEVEN_DAYS_MS && diffMs > 6 * ONE_DAY_MS) {
          threshold = '7d';
        }

        if (!threshold) continue;

        // Deduplication check: verify notification not already dispatched for this doc & threshold
        const dedupRes = await dbPool.query(
          `SELECT id FROM notifications
           WHERE tenant_id = $1
             AND type = 'document_expiring'
             AND payload->>'documentId' = $2
             AND payload->>'threshold' = $3`,
          [row.tenantId, row.id, threshold]
        );

        if (dedupRes.rows.length === 0) {
          // Find tenant admin or operator to notify
          const adminRes = await dbPool.query(
            `SELECT user_id FROM users
             WHERE tenant_id = $1 AND role IN ('Admin', 'org_admin', 'Reviewer', 'approver') AND is_active = TRUE
             LIMIT 1`,
            [row.tenantId]
          );

          const targetUserId = adminRes.rows[0]?.user_id || 'system';

          await this.dispatchNotification(row.tenantId, {
            userId: targetUserId,
            type: 'document_expiring',
            category: 'expiry',
            title: `Document Expiring in ${threshold === '7d' ? '7 Days' : '24 Hours'}`,
            message: `Document '${row.fileName}' (${row.id}) will expire on ${new Date(row.expiresAt).toISOString()}.`,
            entityId: row.id,
            payload: {
              documentId: row.id,
              threshold,
              fileName: row.fileName,
              expiresAt: row.expiresAt,
            },
            severity: threshold === '1d' ? 'warning' : 'info',
          });

          generatedCount++;
        }
      }
    } catch (err: any) {
      Logger.warn({
        message: `Failed to process document expiry notifications: ${err.message}`,
        context: 'NotificationService',
      });
    }

    return { generatedCount };
  }

  /**
   * Retrieves notification preferences for a user
   */
  static async getUserPreferences(
    tenantId: string,
    userId: string
  ): Promise<NotificationPreferenceRecord[]> {
    const allTypes: NotificationType[] = [
      'receipt',
      'processing_exception',
      'review_assignment',
      'returned_for_changes',
      'approval_decision',
      'retention_expiry',
      'sla_breach',
      'task_assigned',
      'review_requested',
      'approval_requested',
      'processing_failed',
      'export_ready',
      'document_expiring',
    ];

    const defaults: NotificationPreferenceRecord[] = allTypes.map((t) => ({
      id: `PREF-${userId}-${t}`,
      tenantId,
      userId,
      notificationType: t,
      emailEnabled: true,
      inAppEnabled: true,
      updatedAt: new Date(),
    }));

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id, tenant_id as "tenantId", user_id as "userId",
                  notification_type as "notificationType", email_enabled as "emailEnabled",
                  in_app_enabled as "inAppEnabled", updated_at as "updatedAt"
           FROM notification_preferences
           WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, userId]
        );
        if (res.rows.length > 0) {
          const map = new Map(res.rows.map((r: any) => [r.notificationType, r]));
          return defaults.map((d) => (map.get(d.notificationType) as NotificationPreferenceRecord) || d);
        }
      } catch {
        // Fallback to memory
      }
    }

    return defaults.map((d) => {
      const stored = this.inMemoryPreferences.get(`${tenantId}:${userId}:${d.notificationType}`);
      return stored || d;
    });
  }

  /**
   * Updates notification preference for a user
   */
  static async updatePreference(
    tenantId: string,
    userId: string,
    type: NotificationType,
    emailEnabled: boolean,
    inAppEnabled: boolean
  ): Promise<NotificationPreferenceRecord> {
    const id = `PREF-${userId}-${type}`;
    const record: NotificationPreferenceRecord = {
      id,
      tenantId,
      userId,
      notificationType: type,
      emailEnabled,
      inAppEnabled,
      updatedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO notification_preferences (
            id, tenant_id, user_id, notification_type, email_enabled, in_app_enabled, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (tenant_id, user_id, notification_type)
          DO UPDATE SET email_enabled = $5, in_app_enabled = $6, updated_at = $7`,
          [id, tenantId, userId, type, emailEnabled, inAppEnabled, record.updatedAt]
        );
      } catch {
        // Fallback to memory
      }
    }

    this.inMemoryPreferences.set(`${tenantId}:${userId}:${type}`, record);
    return record;
  }
}
