import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/approvals/data/datasources/approval_exceptions.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_detail.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_item.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/erp_publication.dart';
import 'package:docunexa_mobile/features/approvals/domain/repositories/approval_repository.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_bloc.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_event.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_state.dart';

class MockApprovalRepository extends Mock implements ApprovalRepository {}

void main() {
  late MockApprovalRepository mockRepository;
  late ApprovalDetailBloc bloc;

  final sampleRequest = ApprovalRequestDetail(
    id: 'req-1',
    documentId: 'doc-101',
    tenantId: 'tenant-1',
    status: ApprovalStatus.pending,
    tier: ApprovalTier.tier2,
    monetaryAmount: 25000.0,
    currency: '\$',
    requiredApprovals: 2,
    approvedCount: 0,
    sourceVersion: 'v1.0',
    submittedBy: 'submitter@acme.com',
    createdAt: DateTime.parse('2026-10-17T09:00:00Z'),
    updatedAt: DateTime.parse('2026-10-17T09:00:00Z'),
    decisions: const [],
  );

  setUp(() {
    mockRepository = MockApprovalRepository();
    bloc = ApprovalDetailBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('ApprovalDetailBloc Tests', () {
    test('initial state is ApprovalDetailInitial', () {
      expect(bloc.state, isA<ApprovalDetailInitial>());
    });

    blocTest<ApprovalDetailBloc, ApprovalDetailState>(
      'loads request details on LoadApprovalDetail',
      build: () {
        when(() => mockRepository.getApprovalDetails('doc-101')).thenAnswer((_) async => sampleRequest);
        when(() => mockRepository.getErpPublicationStatus('doc-101')).thenAnswer((_) async => null);
        return bloc;
      },
      act: (b) => b.add(const LoadApprovalDetail('doc-101')),
      expect: () => [
        isA<ApprovalDetailLoading>(),
        isA<ApprovalDetailLoaded>().having((s) => s.request.documentId, 'documentId', 'doc-101'),
      ],
    );

    blocTest<ApprovalDetailBloc, ApprovalDetailState>(
      'surfaces SoD violation code and explanation when SodViolationException is thrown',
      seed: () => ApprovalDetailLoaded(request: sampleRequest),
      build: () {
        when(() => mockRepository.submitApprovalDecision(
              documentId: 'doc-101',
              action: ApprovalAction.approve,
              reasonCode: any(named: 'reasonCode'),
              comments: any(named: 'comments'),
              sourceVersion: any(named: 'sourceVersion'),
            )).thenThrow(const SodViolationException(
          'Submitter cannot sign off on their own upload.',
          code: 'SOD_VIOLATION_SUBMITTER',
        ));
        return bloc;
      },
      act: (b) => b.add(const SubmitApprovalDecisionEvent(
        action: ApprovalAction.approve,
        reasonCode: 'Verified',
      )),
      expect: () => [
        isA<ApprovalDetailLoaded>().having((s) => s.isSubmittingDecision, 'isSubmittingDecision', true),
        isA<ApprovalDetailLoaded>()
            .having((s) => s.isSubmittingDecision, 'isSubmittingDecision', false)
            .having((s) => s.sodViolationCode, 'sodViolationCode', 'SOD_VIOLATION_SUBMITTER')
            .having((s) => s.sodViolationMessage, 'sodViolationMessage', contains('You uploaded this document')),
      ],
    );

    blocTest<ApprovalDetailBloc, ApprovalDetailState>(
      'emits ApprovalDecisionSuccessState on valid decision submission',
      seed: () => ApprovalDetailLoaded(request: sampleRequest),
      build: () {
        when(() => mockRepository.submitApprovalDecision(
              documentId: 'doc-101',
              action: ApprovalAction.approve,
              reasonCode: any(named: 'reasonCode'),
              comments: any(named: 'comments'),
              sourceVersion: any(named: 'sourceVersion'),
            )).thenAnswer((_) async => ApprovalDecisionResult(
              request: sampleRequest,
              isFullyApproved: false,
            ));
        return bloc;
      },
      act: (b) => b.add(const SubmitApprovalDecisionEvent(
        action: ApprovalAction.approve,
        reasonCode: 'Verified',
      )),
      expect: () => [
        isA<ApprovalDetailLoaded>().having((s) => s.isSubmittingDecision, 'isSubmittingDecision', true),
        isA<ApprovalDecisionSuccessState>(),
      ],
    );
  });
}
