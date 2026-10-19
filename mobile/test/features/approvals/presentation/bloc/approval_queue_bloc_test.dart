import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_item.dart';
import 'package:docunexa_mobile/features/approvals/domain/repositories/approval_repository.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_queue/approval_queue_bloc.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_queue/approval_queue_event.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_queue/approval_queue_state.dart';

class MockApprovalRepository extends Mock implements ApprovalRepository {}

void main() {
  late MockApprovalRepository mockRepository;
  late ApprovalQueueBloc bloc;

  final sampleItems = [
    ApprovalQueueItem(
      id: 'appr-1',
      documentId: 'doc-1',
      tenantId: 'tenant-1',
      documentTitle: 'Invoice #1001',
      documentType: 'INVOICE',
      tier: ApprovalTier.tier1,
      amount: 4500.0,
      currency: '\$',
      submittedBy: 'alice@acme.com',
      status: ApprovalStatus.pending,
      requiredApprovals: 1,
      approvedCount: 0,
      priority: 'Low',
      submittedAt: DateTime.parse('2026-10-17T08:00:00Z'),
      sourceVersion: 'v1.0',
    ),
    ApprovalQueueItem(
      id: 'appr-2',
      documentId: 'doc-2',
      tenantId: 'tenant-1',
      documentTitle: 'Contract #5001',
      documentType: 'CONTRACT',
      tier: ApprovalTier.tier3,
      amount: 150000.0,
      currency: '\$',
      submittedBy: 'bob@acme.com',
      status: ApprovalStatus.pending,
      requiredApprovals: 2,
      approvedCount: 0,
      priority: 'High',
      submittedAt: DateTime.parse('2026-10-17T09:00:00Z'),
      sourceVersion: 'v1.0',
    ),
  ];

  setUp(() {
    mockRepository = MockApprovalRepository();
    bloc = ApprovalQueueBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('ApprovalQueueBloc Tests', () {
    test('initial state is ApprovalQueueInitial', () {
      expect(bloc.state, isA<ApprovalQueueInitial>());
    });

    blocTest<ApprovalQueueBloc, ApprovalQueueState>(
      'emits [ApprovalQueueLoading, ApprovalQueueLoaded] on FetchApprovalQueue success',
      build: () {
        when(() => mockRepository.getApprovalQueue()).thenAnswer((_) async => sampleItems);
        return bloc;
      },
      act: (b) => b.add(const FetchApprovalQueue()),
      expect: () => [
        isA<ApprovalQueueLoading>(),
        isA<ApprovalQueueLoaded>().having((s) => s.allItems.length, 'allItems.length', 2),
      ],
    );

    blocTest<ApprovalQueueBloc, ApprovalQueueState>(
      'filters queue items when FilterApprovalQueueByTier is added',
      seed: () => ApprovalQueueLoaded(
        allItems: sampleItems,
        filteredItems: sampleItems,
      ),
      build: () => bloc,
      act: (b) => b.add(const FilterApprovalQueueByTier(ApprovalTier.tier3)),
      expect: () => [
        isA<ApprovalQueueLoaded>()
            .having((s) => s.filteredItems.length, 'filteredItems.length', 1)
            .having((s) => s.filteredItems.first.documentId, 'documentId', 'doc-2')
            .having((s) => s.selectedTier, 'selectedTier', ApprovalTier.tier3),
      ],
    );
  });
}
