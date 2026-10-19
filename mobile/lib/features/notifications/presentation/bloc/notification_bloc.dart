import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/notification_item.dart';
import '../../domain/repositories/notification_repository.dart';
import 'notification_event.dart';
import 'notification_state.dart';

class NotificationBloc extends Bloc<NotificationEvent, NotificationState> {
  final NotificationRepository repository;
  StreamSubscription<NotificationItem>? _streamSubscription;

  NotificationBloc({required this.repository}) : super(const NotificationState()) {
    on<NotificationsFetchRequested>(_onFetchRequested);
    on<NotificationMarkReadRequested>(_onMarkReadRequested);
    on<NotificationMarkAllReadRequested>(_onMarkAllReadRequested);
    on<NotificationFilterChanged>(_onFilterChanged);
    on<NotificationStreamSubscribed>(_onStreamSubscribed);
    on<NotificationReceivedFromStream>(_onReceivedFromStream);
  }

  Future<void> _onFetchRequested(
    NotificationsFetchRequested event,
    Emitter<NotificationState> emit,
  ) async {
    final category = event.category ?? state.selectedCategory;
    final unreadOnly = event.unreadOnly ?? state.unreadOnly;

    emit(state.copyWith(
      isLoading: true,
      clearError: true,
      selectedCategory: category,
      clearCategory: event.category == null && category == null,
      unreadOnly: unreadOnly,
    ));

    try {
      final result = await repository.getNotifications(
        category: category,
        unreadOnly: unreadOnly,
      );

      emit(state.copyWith(
        isLoading: false,
        notifications: result.notifications,
        unreadCount: result.unreadCount,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onMarkReadRequested(
    NotificationMarkReadRequested event,
    Emitter<NotificationState> emit,
  ) async {
    // Optimistically update item
    final updatedList = state.notifications.map((n) {
      if (n.id == event.id) {
        return n.copyWith(read: true, readAt: DateTime.now());
      }
      return n;
    }).toList();

    final newUnreadCount = (state.unreadCount - 1).clamp(0, 9999);

    emit(state.copyWith(
      notifications: updatedList,
      unreadCount: newUnreadCount,
    ));

    try {
      await repository.markAsRead(event.id);
    } catch (_) {
      // If failed, re-fetch from server to re-align state
      add(const NotificationsFetchRequested());
    }
  }

  Future<void> _onMarkAllReadRequested(
    NotificationMarkAllReadRequested event,
    Emitter<NotificationState> emit,
  ) async {
    emit(state.copyWith(isUpdating: true));
    try {
      await repository.markAllAsRead();
      final updatedList = state.notifications
          .map((n) => n.copyWith(read: true, readAt: DateTime.now()))
          .toList();

      emit(state.copyWith(
        isUpdating: false,
        notifications: updatedList,
        unreadCount: 0,
      ));
    } catch (e) {
      emit(state.copyWith(
        isUpdating: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  void _onFilterChanged(
    NotificationFilterChanged event,
    Emitter<NotificationState> emit,
  ) {
    add(NotificationsFetchRequested(
      category: event.category,
      unreadOnly: event.unreadOnly,
    ));
  }

  void _onStreamSubscribed(
    NotificationStreamSubscribed event,
    Emitter<NotificationState> emit,
  ) {
    _streamSubscription?.cancel();
    _streamSubscription = repository.getNotificationStream().listen(
      (notification) {
        add(NotificationReceivedFromStream(notification));
      },
      onError: (_) {
        // Stream reconnect or error fallback
      },
    );
  }

  void _onReceivedFromStream(
    NotificationReceivedFromStream event,
    Emitter<NotificationState> emit,
  ) {
    final current = List<NotificationItem>.from(state.notifications);
    if (!current.any((n) => n.id == event.notification.id)) {
      current.insert(0, event.notification);
      final newUnread = event.notification.read ? state.unreadCount : state.unreadCount + 1;
      emit(state.copyWith(
        notifications: current,
        unreadCount: newUnread,
      ));
    }
  }

  @override
  Future<void> close() {
    _streamSubscription?.cancel();
    return super.close();
  }
}
