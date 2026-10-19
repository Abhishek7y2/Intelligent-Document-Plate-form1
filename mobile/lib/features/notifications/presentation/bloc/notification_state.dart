import 'package:equatable/equatable.dart';
import '../../domain/entities/notification_item.dart';

class NotificationState extends Equatable {
  final List<NotificationItem> notifications;
  final int unreadCount;
  final bool isLoading;
  final bool isUpdating;
  final NotificationCategory? selectedCategory;
  final bool unreadOnly;
  final String? errorMessage;

  const NotificationState({
    this.notifications = const [],
    this.unreadCount = 0,
    this.isLoading = false,
    this.isUpdating = false,
    this.selectedCategory,
    this.unreadOnly = false,
    this.errorMessage,
  });

  NotificationState copyWith({
    List<NotificationItem>? notifications,
    int? unreadCount,
    bool? isLoading,
    bool? isUpdating,
    NotificationCategory? selectedCategory,
    bool clearCategory = false,
    bool? unreadOnly,
    String? errorMessage,
    bool clearError = false,
  }) {
    return NotificationState(
      notifications: notifications ?? this.notifications,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoading: isLoading ?? this.isLoading,
      isUpdating: isUpdating ?? this.isUpdating,
      selectedCategory: clearCategory ? null : (selectedCategory ?? this.selectedCategory),
      unreadOnly: unreadOnly ?? this.unreadOnly,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [
        notifications,
        unreadCount,
        isLoading,
        isUpdating,
        selectedCategory,
        unreadOnly,
        errorMessage,
      ];
}
