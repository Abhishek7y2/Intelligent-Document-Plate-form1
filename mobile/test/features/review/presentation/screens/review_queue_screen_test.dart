import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/review/domain/entities/review_task.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_queue/review_queue_bloc.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_queue/review_queue_event.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_queue/review_queue_state.dart';
import 'package:docunexa_mobile/features/review/presentation/screens/review_queue_screen.dart';

class MockReviewQueueBloc extends MockBloc<ReviewQueueEvent, ReviewQueueState>
    implements ReviewQueueBloc {}

void main() {
  late MockReviewQueueBloc mockBloc;

  setUp(() {
    mockBloc = MockReviewQueueBloc();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: ReviewQueueScreen(bloc: mockBloc),
    );
  }

  group('ReviewQueueScreen Widget Tests', () {
    testWidgets('displays loading indicator when state is ReviewQueueLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(ReviewQueueLoading());

      await tester.pumpWidget(buildTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays empty state when queue has no tasks', (tester) async {
      when(() => mockBloc.state).thenReturn(const ReviewQueueLoaded(
        tasks: [],
        total: 0,
        page: 1,
        hasMore: false,
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Queue is Clear'), findsOneWidget);
      expect(find.text('No documents currently require manual review.'), findsOneWidget);
    });

    testWidgets('displays error view with retry button on error', (tester) async {
      when(() => mockBloc.state).thenReturn(const ReviewQueueError(
        message: 'Network connection failed',
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Network connection failed'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Retry'), findsOneWidget);
    });

    testWidgets('renders task card list with details and priority chips', (tester) async {
      final sampleTasks = [
        ReviewTaskItem(
          id: 'task-1',
          docId: 'doc-101',
          tenantId: 'tenant-test',
          documentTitle: 'Invoice ACME Corp',
          assignee: 'reviewer@docunexa.com',
          slaHoursLeft: 3,
          status: 'PENDING_REVIEW',
          priority: 'high',
          confidence: 0.74,
          pages: 2,
          submittedAt: DateTime.parse('2026-10-17T08:00:00Z'),
          type: 'invoice',
        ),
      ];

      when(() => mockBloc.state).thenReturn(ReviewQueueLoaded(
        tasks: sampleTasks,
        total: 1,
        page: 1,
        hasMore: false,
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Invoice ACME Corp'), findsOneWidget);
      expect(find.text('HIGH'), findsOneWidget);
      expect(find.text('74%'), findsOneWidget);
      expect(find.text('3h SLA'), findsOneWidget);
      expect(find.text('2 pages'), findsOneWidget);
    });
  });
}
