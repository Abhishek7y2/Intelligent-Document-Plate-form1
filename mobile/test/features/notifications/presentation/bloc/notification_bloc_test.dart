import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/notifications/domain/entities/notification_item.dart';
import 'package:docunexa_mobile/features/notifications/domain/repositories/notification_repository.dart';
import 'package:docunexa_mobile/features/notifications/presentation/bloc/notification_bloc.dart';
import 'package:docunexa_mobile/features/notifications/presentation/bloc/notification_event.dart';
import 'package:docunexa_mobile/features/notifications/presentation/bloc/notification_state.dart';

class MockNotificationRepository extends Mock implements NotificationRepository {}

void main() {
  late MockNotificationRepository mockRepository;
  late NotificationBloc bloc;

  final sampleNotifications = [
    NotificationItem(
      id: 'notif-1',
      title: 'Task Assigned',
      message: 'You were assigned task: Review Invoice INV-900',
      category: NotificationCategory.tasks,
      severity: NotificationSeverity.info,
      read: false,
      targetUrl: '/tasks/task-123',
      createdAt: DateTime.parse('2026-10-17T12:00:00Z'),
    ),
    NotificationItem(
      id: 'notif-2',
      title: 'Approval Required',
      message: 'Document DOC-456 requires Tier 2 approval',
      category: NotificationCategory.approvals,
      severity: NotificationSeverity.warning,
      read: true,
      targetUrl: '/approvals/doc-456',
      createdAt: DateTime.parse('2026-10-17T11:00:00Z'),
    ),
  ];

  final sampleListResult = NotificationListResult(
    notifications: sampleNotifications,
    unreadCount: 1,
  );

  setUp(() {
    mockRepository = MockNotificationRepository();
    bloc = NotificationBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('NotificationBloc Tests', () {
    test('initial state is default NotificationState', () {
      expect(bloc.state, const NotificationState());
    });

    blocTest<NotificationBloc, NotificationState>(
      'fetches notifications successfully',
      build: () {
        when(() => mockRepository.getNotifications(
              category: null,
              unreadOnly: false,
            )).thenAnswer((_) async => sampleListResult);
        return bloc;
      },
      act: (b) => b.add(const NotificationsFetchRequested()),
      expect: () => [
        const NotificationState(isLoading: true),
        NotificationState(
          isLoading: false,
          notifications: sampleNotifications,
          unreadCount: 1,
        ),
      ],
    );

    blocTest<NotificationBloc, NotificationState>(
      'marks notification as read optimistically',
      seed: () => NotificationState(
        notifications: sampleNotifications,
        unreadCount: 1,
      ),
      build: () {
        when(() => mockRepository.markAsRead('notif-1'))
            .thenAnswer((_) async => true);
        return bloc;
      },
      act: (b) => b.add(const NotificationMarkReadRequested('notif-1')),
      verify: (_) {
        verify(() => mockRepository.markAsRead('notif-1')).called(1);
      },
    );

    blocTest<NotificationBloc, NotificationState>(
      'marks all notifications as read',
      seed: () => NotificationState(
        notifications: sampleNotifications,
        unreadCount: 1,
      ),
      build: () {
        when(() => mockRepository.markAllAsRead())
            .thenAnswer((_) async => 1);
        return bloc;
      },
      act: (b) => b.add(const NotificationMarkAllReadRequested()),
      expect: () => [
        NotificationState(
          notifications: sampleNotifications,
          unreadCount: 1,
          isUpdating: true,
        ),
        NotificationState(
          notifications: sampleNotifications.map((n) => n.copyWith(read: true)).toList(),
          unreadCount: 0,
          isUpdating: false,
        ),
      ],
    );
  });
}
