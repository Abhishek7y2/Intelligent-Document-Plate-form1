import '../entities/notification_item.dart';

abstract class NotificationRepository {
  Future<NotificationListResult> getNotifications({
    NotificationCategory? category,
    bool unreadOnly = false,
    int limit = 50,
    int offset = 0,
  });

  Future<bool> markAsRead(String id);

  Future<int> markAllAsRead();

  Stream<NotificationItem> getNotificationStream();
}
