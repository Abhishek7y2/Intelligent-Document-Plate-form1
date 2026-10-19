import { NotificationService } from './notification.service.js';

describe('Notification Service (Sprint 11 - FR-016, SEC-007)', () => {
  const TENANT_A = 'TNT-CORP-ALPHA';
  const TENANT_B = 'TNT-CORP-BETA';
  const USER_A = 'USR-OPERATOR-01';

  beforeEach(() => {
    NotificationService.setStoreMode('memory');
    NotificationService.clearInMemory();
  });

  describe('Template Rendering & Dispatching', () => {
    it('should dispatch document receipt notification with in-app and email channels', async () => {
      const result = await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'receipt',
        category: 'tasks',
        title: 'New Document Received',
        message: 'Invoice INV-9021 has been uploaded and queued.',
        severity: 'info',
        entityId: 'DOC-9021',
        channel: 'both',
      });

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^NOTIF-/);
      expect(result.tenantId).toBe(TENANT_A);
      expect(result.userId).toBe(USER_A);
      expect(result.type).toBe('receipt');
      expect(result.read).toBe(false);
      expect(result.deliveryStatus).toBe('DELIVERED');
      expect(result.deliveryAttempts).toBe(1);
    });

    it('should dispatch all 6 core business notification types', async () => {
      const types: Array<{ type: any; category: any; title: string }> = [
        { type: 'receipt', category: 'tasks', title: 'Receipt' },
        { type: 'processing_exception', category: 'failures', title: 'Processing Exception' },
        { type: 'review_assignment', category: 'tasks', title: 'Task Assignment' },
        { type: 'returned_for_changes', category: 'tasks', title: 'Returned for Changes' },
        { type: 'approval_decision', category: 'approvals', title: 'Approval Decision' },
        { type: 'retention_expiry', category: 'expiry', title: 'Retention Expiry' },
      ];

      for (const t of types) {
        const notif = await NotificationService.dispatchNotification(TENANT_A, {
          userId: USER_A,
          type: t.type,
          category: t.category,
          title: t.title,
          message: `Testing event for ${t.type}`,
        });
        expect(notif.type).toBe(t.type);
        expect(notif.deliveryStatus).toBe('DELIVERED');
      }

      const list = await NotificationService.listUserNotifications(TENANT_A, USER_A);
      expect(list.notifications.length).toBe(6);
      expect(list.unreadCount).toBe(6);
    });
  });

  describe('User Preferences & Channel Control', () => {
    it('should suppress notification when user preference disables delivery channel', async () => {
      // Disable inApp and email for retention_expiry
      await NotificationService.updatePreference(TENANT_A, USER_A, 'retention_expiry', false, false);

      const notif = await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'retention_expiry',
        category: 'expiry',
        title: 'Policy Expiry Warning',
        message: 'Document will expire in 2 days.',
      });

      expect(notif.deliveryStatus).toBe('FAILED');
      expect(notif.errorMessage).toContain('disabled');
    });

    it('should respect default preferences if user has not customized them', async () => {
      const prefs = await NotificationService.getUserPreferences(TENANT_A, USER_A);
      expect(prefs.length).toBeGreaterThan(0);
      expect(prefs.every((p) => p.emailEnabled && p.inAppEnabled)).toBe(true);
    });
  });

  describe('Read State & Filtering', () => {
    it('should mark single notification as read', async () => {
      const notif = await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'receipt',
        category: 'tasks',
        title: 'Test',
        message: 'Test message',
      });

      const updated = await NotificationService.markNotificationRead(TENANT_A, USER_A, notif.id);
      expect(updated).toBe(true);

      const list = await NotificationService.listUserNotifications(TENANT_A, USER_A);
      expect(list.unreadCount).toBe(0);
    });

    it('should mark all notifications as read in bulk', async () => {
      await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'receipt',
        category: 'tasks',
        title: 'Test 1',
        message: 'Message 1',
      });
      await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'review_assignment',
        category: 'tasks',
        title: 'Test 2',
        message: 'Message 2',
      });

      const count = await NotificationService.markAllNotificationsRead(TENANT_A, USER_A);
      expect(count).toBe(2);

      const list = await NotificationService.listUserNotifications(TENANT_A, USER_A, { unreadOnly: true });
      expect(list.notifications.length).toBe(0);
      expect(list.unreadCount).toBe(0);
    });

    it('should filter notifications by category', async () => {
      await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'review_assignment',
        category: 'tasks',
        title: 'Task Assigned',
        message: 'Verify line items',
      });
      await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'retention_expiry',
        category: 'expiry',
        title: 'Document Expiry',
        message: 'Archival policy triggered',
      });

      const tasksOnly = await NotificationService.listUserNotifications(TENANT_A, USER_A, { category: 'tasks' });
      expect(tasksOnly.notifications.length).toBe(1);
      expect(tasksOnly.notifications[0].category).toBe('tasks');

      const expiryOnly = await NotificationService.listUserNotifications(TENANT_A, USER_A, { category: 'expiry' });
      expect(expiryOnly.notifications.length).toBe(1);
      expect(expiryOnly.notifications[0].category).toBe('expiry');
    });
  });

  describe('Multi-Tenant Isolation & Security', () => {
    it('should not allow Tenant B to see Tenant A notifications', async () => {
      await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'receipt',
        category: 'tasks',
        title: 'Tenant A Sensitive Invoice',
        message: 'Invoice from Vendor Secret',
      });

      const tenantBList = await NotificationService.listUserNotifications(TENANT_B, USER_A);
      expect(tenantBList.notifications.length).toBe(0);
    });

    it('should reject marking read across tenant boundaries', async () => {
      const notif = await NotificationService.dispatchNotification(TENANT_A, {
        userId: USER_A,
        type: 'receipt',
        category: 'tasks',
        title: 'Tenant A Document',
        message: 'Do not access',
      });

      const updated = await NotificationService.markNotificationRead(TENANT_B, USER_A, notif.id);
      expect(updated).toBe(false);
    });
  });
});
