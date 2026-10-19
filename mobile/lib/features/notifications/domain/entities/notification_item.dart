import 'package:equatable/equatable.dart';

enum NotificationCategory {
  tasks,
  approvals,
  failures,
  expiry,
  general;

  String get displayName {
    switch (this) {
      case NotificationCategory.tasks:
        return 'Tasks';
      case NotificationCategory.approvals:
        return 'Approvals';
      case NotificationCategory.failures:
        return 'Alerts / Failures';
      case NotificationCategory.expiry:
        return 'Retention & Expiry';
      case NotificationCategory.general:
        return 'General';
    }
  }

  static NotificationCategory fromString(String category) {
    switch (category.toLowerCase()) {
      case 'tasks':
        return NotificationCategory.tasks;
      case 'approvals':
        return NotificationCategory.approvals;
      case 'failures':
        return NotificationCategory.failures;
      case 'expiry':
        return NotificationCategory.expiry;
      default:
        return NotificationCategory.general;
    }
  }
}

enum NotificationSeverity {
  info,
  warning,
  error,
  success;

  static NotificationSeverity fromString(String severity) {
    switch (severity.toLowerCase()) {
      case 'warning':
        return NotificationSeverity.warning;
      case 'error':
        return NotificationSeverity.error;
      case 'success':
        return NotificationSeverity.success;
      default:
        return NotificationSeverity.info;
    }
  }
}

class NotificationItem extends Equatable {
  final String id;
  final String title;
  final String message;
  final NotificationCategory category;
  final NotificationSeverity severity;
  final bool read;
  final String? targetUrl;
  final String? entityId;
  final DateTime createdAt;
  final DateTime? readAt;

  const NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.category,
    required this.severity,
    required this.read,
    this.targetUrl,
    this.entityId,
    required this.createdAt,
    this.readAt,
  });

  NotificationItem copyWith({
    String? id,
    String? title,
    String? message,
    NotificationCategory? category,
    NotificationSeverity? severity,
    bool? read,
    String? targetUrl,
    String? entityId,
    DateTime? createdAt,
    DateTime? readAt,
  }) {
    return NotificationItem(
      id: id ?? this.id,
      title: title ?? this.title,
      message: message ?? this.message,
      category: category ?? this.category,
      severity: severity ?? this.severity,
      read: read ?? this.read,
      targetUrl: targetUrl ?? this.targetUrl,
      entityId: entityId ?? this.entityId,
      createdAt: createdAt ?? this.createdAt,
      readAt: readAt ?? this.readAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        title,
        message,
        category,
        severity,
        read,
        targetUrl,
        entityId,
        createdAt,
        readAt,
      ];
}

class NotificationListResult extends Equatable {
  final List<NotificationItem> notifications;
  final int unreadCount;

  const NotificationListResult({
    required this.notifications,
    required this.unreadCount,
  });

  @override
  List<Object?> get props => [notifications, unreadCount];
}
