import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/notifications/domain/entities/notification_item.dart';
import 'package:docunexa_mobile/features/notifications/presentation/bloc/notification_bloc.dart';
import 'package:docunexa_mobile/features/notifications/presentation/bloc/notification_event.dart';
import 'package:docunexa_mobile/features/notifications/presentation/bloc/notification_state.dart';
import 'package:docunexa_mobile/features/notifications/presentation/screens/notification_center_screen.dart';

class MockNotificationBloc extends MockBloc<NotificationEvent, NotificationState>
    implements NotificationBloc {}

void main() {
  late MockNotificationBloc mockBloc;

  final sampleNotification = NotificationItem(
    id: 'n-1',
    title: 'Extraction SLA Warning',
    message: 'Invoice 1099 has been pending OCR review for > 2 hours.',
    category: NotificationCategory.failures,
    severity: NotificationSeverity.warning,
    read: false,
    createdAt: DateTime.parse('2026-10-17T13:00:00Z'),
  );

  setUp(() {
    mockBloc = MockNotificationBloc();
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  testWidgets('renders empty state when no notifications exist', (tester) async {
    when(() => mockBloc.state).thenReturn(const NotificationState(
      notifications: [],
      unreadCount: 0,
      isLoading: false,
    ));

    await tester.pumpWidget(buildTestableWidget(NotificationCenterScreen(bloc: mockBloc)));

    expect(find.text('Notification Center'), findsOneWidget);
    expect(find.text('No notifications in this view'), findsOneWidget);
  });

  testWidgets('renders notification tile and unread pill correctly', (tester) async {
    when(() => mockBloc.state).thenReturn(NotificationState(
      notifications: [sampleNotification],
      unreadCount: 1,
      isLoading: false,
    ));

    await tester.pumpWidget(buildTestableWidget(NotificationCenterScreen(bloc: mockBloc)));

    expect(find.text('Extraction SLA Warning'), findsOneWidget);
    expect(find.text('Invoice 1099 has been pending OCR review for > 2 hours.'), findsOneWidget);
    expect(find.text('Mark all read'), findsOneWidget);
  });
}
