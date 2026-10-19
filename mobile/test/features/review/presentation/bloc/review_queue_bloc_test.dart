import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/review/domain/entities/review_task.dart';
import 'package:docunexa_mobile/features/review/domain/repositories/review_repository.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_queue/review_queue_bloc.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_queue/review_queue_event.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_queue/review_queue_state.dart';

class MockReviewRepository extends Mock implements ReviewRepository {}

void main() {
  late MockReviewRepository mockRepository;
  late ReviewQueueBloc bloc;

  final sampleTasks = [
    ReviewTaskItem(
      id: 'task-1',
      docId: 'doc-1',
      tenantId: 'tenant-1',
      documentTitle: 'Invoice 101',
      assignee: 'reviewer@docunexa.com',
      slaHoursLeft: 6,
      status: 'PENDING_REVIEW',
      priority: 'high',
      confidence: 0.82,
      pages: 1,
      submittedAt: DateTime.parse('2026-10-17T09:00:00Z'),
      type: 'INVOICE',
    ),
  ];

  setUp(() {
    mockRepository = MockReviewRepository();
    bloc = ReviewQueueBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('ReviewQueueBloc Tests', () {
    test('initial state is ReviewQueueInitial', () {
      expect(bloc.state, isA<ReviewQueueInitial>());
    });

    blocTest<ReviewQueueBloc, ReviewQueueState>(
      'emits [ReviewQueueLoading, ReviewQueueLoaded] when FetchReviewQueue succeeds',
      build: () {
        when(() => mockRepository.getReviewQueue(
              status: any(named: 'status'),
              priority: any(named: 'priority'),
              page: any(named: 'page'),
              limit: any(named: 'limit'),
            )).thenAnswer((_) async => sampleTasks);
        return bloc;
      },
      act: (b) => b.add(const FetchReviewQueue()),
      expect: () => [
        isA<ReviewQueueLoading>(),
        isA<ReviewQueueLoaded>()
            .having((s) => s.tasks.length, 'tasks.length', 1)
            .having((s) => s.tasks.first.docId, 'first.docId', 'doc-1'),
      ],
    );

    blocTest<ReviewQueueBloc, ReviewQueueState>(
      'emits [ReviewQueueLoading, ReviewQueueError] when FetchReviewQueue fails',
      build: () {
        when(() => mockRepository.getReviewQueue(
              status: any(named: 'status'),
              priority: any(named: 'priority'),
              page: any(named: 'page'),
              limit: any(named: 'limit'),
            )).thenThrow(Exception('Queue unavailable'));
        return bloc;
      },
      act: (b) => b.add(const FetchReviewQueue()),
      expect: () => [
        isA<ReviewQueueLoading>(),
        isA<ReviewQueueError>().having((s) => s.message, 'message', contains('Queue unavailable')),
      ],
    );

    blocTest<ReviewQueueBloc, ReviewQueueState>(
      'emits [ReviewQueueLoading, ReviewQueueLoaded] with filtered priority on FilterReviewQueueByPriority',
      build: () {
        when(() => mockRepository.getReviewQueue(
              priority: 'high',
              page: 1,
              limit: 20,
            )).thenAnswer((_) async => sampleTasks);
        return bloc;
      },
      act: (b) => b.add(const FilterReviewQueueByPriority('high')),
      expect: () => [
        isA<ReviewQueueLoading>(),
        isA<ReviewQueueLoaded>()
            .having((s) => s.selectedPriority, 'selectedPriority', 'high')
            .having((s) => s.tasks.length, 'tasks.length', 1),
      ],
    );
  });
}
