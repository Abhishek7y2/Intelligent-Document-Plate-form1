import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/notifications/domain/entities/notification_item.dart';
import 'package:mobile/features/notifications/domain/repositories/notification_repository.dart';
import 'package:mobile/features/notifications/presentation/bloc/notification_bloc.dart';
import 'package:mobile/features/notifications/presentation/bloc/notification_event.dart';
import 'package:mobile/features/notifications/presentation/bloc/notification_state.dart';

class FakeNotificationRepository implements NotificationRepository {
  final StreamController<NotificationItem> streamController = StreamController<NotificationItem>.broadcast();

  @override
  Future<NotificationListResult> getNotifications({
    NotificationCategory? category,
    bool unreadOnly = false,
    int limit = 50,
    int offset = 0,
  }) async {
    return const NotificationListResult(
      notifications: [],
      total: 0,
      unreadCount: 0,
    );
  }

  @override
  Future<bool> markAsRead(String id) async => true;

  @override
  Future<int> markAllAsRead() async => 0;

  @override
  Stream<NotificationItem> getNotificationStream() => streamController.stream;

  void emitNotification(NotificationItem item) {
    streamController.add(item);
  }

  void dispose() {
    streamController.close();
  }
}

void main() {
  group('NotificationBloc Real-Time SSE Stream Tests', () {
    late FakeNotificationRepository fakeRepo;
    late NotificationBloc bloc;

    setUp(() {
      fakeRepo = FakeNotificationRepository();
      bloc = NotificationBloc(repository: fakeRepo);
    });

    tearDown(() {
      bloc.close();
      fakeRepo.dispose();
    });

    test('subscribes to stream and dynamically prepends new incoming notifications', () async {
      // Subscribe to real-time SSE stream
      bloc.add(const NotificationStreamSubscribed());
      await Future<void>.delayed(const Duration(milliseconds: 50));

      final incomingItem = NotificationItem(
        id: 'NOTIF-LIVE-99',
        type: NotificationType.reviewAssignment,
        category: NotificationCategory.tasks,
        title: 'New Review Task Assigned',
        message: 'Document DOC-9041 requires your verification.',
        createdAt: DateTime.now(),
        read: false,
        severity: NotificationSeverity.warning,
        targetUrl: '/review/DOC-9041',
      );

      // Emit incoming SSE item
      fakeRepo.emitNotification(incomingItem);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // Assert state updated with new notification and unread count incremented
      expect(bloc.state.notifications.length, equals(1));
      expect(bloc.state.notifications.first.id, equals('NOTIF-LIVE-99'));
      expect(bloc.state.unreadCount, equals(1));
    });
  });
}
