import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/operations_job.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_bloc.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_event.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_state.dart';
import 'package:docunexa_mobile/features/admin/presentation/screens/operations_queue_screen.dart';

class MockAdminBloc extends MockBloc<AdminEvent, AdminState> implements AdminBloc {}

void main() {
  late MockAdminBloc mockBloc;

  final sampleDlqJobs = [
    OperationsJob(
      id: 'job-909',
      queueName: 'ocr_extraction',
      documentId: 'doc-888',
      errorMessage: 'Socket timeout contacting OCR extraction microservice',
      failedAt: DateTime(2026, 10, 17, 9, 30),
      retryCount: 2,
      isRetrying: false,
    ),
  ];

  setUp(() {
    mockBloc = MockAdminBloc();
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  testWidgets('renders loading state when DLQ jobs are fetching', (tester) async {
    when(() => mockBloc.state).thenReturn(const AdminState(isLoadingDlq: true));

    await tester.pumpWidget(buildTestableWidget(OperationsQueueScreen(bloc: mockBloc)));

    expect(find.text('Dead-Letter Queue'), findsOneWidget);
    expect(find.text('Loading dead-letter queue...'), findsOneWidget);
  });

  testWidgets('renders empty state when DLQ has zero failed jobs', (tester) async {
    when(() => mockBloc.state).thenReturn(const AdminState(dlqJobs: []));

    await tester.pumpWidget(buildTestableWidget(OperationsQueueScreen(bloc: mockBloc)));

    expect(find.text('All Queues Healthy'), findsOneWidget);
    expect(find.text('No failed or dead-letter background jobs detected.'), findsOneWidget);
  });

  testWidgets('renders job card with error message, retry count, and retry action', (tester) async {
    when(() => mockBloc.state).thenReturn(AdminState(dlqJobs: sampleDlqJobs));

    await tester.pumpWidget(buildTestableWidget(OperationsQueueScreen(bloc: mockBloc)));

    expect(find.text('Queue: ocr_extraction'), findsOneWidget);
    expect(find.text('Job ID: job-909'), findsOneWidget);
    expect(find.text('Socket timeout contacting OCR extraction microservice'), findsOneWidget);
    expect(find.text('Retried 2x'), findsOneWidget);
    expect(find.text('Retry Job'), findsOneWidget);
  });

  testWidgets('renders permission denied card when user lacks ADMIN_ACCESS', (tester) async {
    when(() => mockBloc.state).thenReturn(const AdminState(
      isPermissionDenied: true,
      permissionDeniedMessage: 'Inspecting operations DLQ requires ADMIN_ACCESS permission.',
    ));

    await tester.pumpWidget(buildTestableWidget(OperationsQueueScreen(bloc: mockBloc)));

    expect(find.text('Access Restricted'), findsOneWidget);
    expect(find.text('Inspecting operations DLQ requires ADMIN_ACCESS permission.'), findsOneWidget);
  });
}
