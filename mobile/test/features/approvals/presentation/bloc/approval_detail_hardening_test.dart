import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_request.dart';
import 'package:docunexa_mobile/features/approvals/domain/repositories/approval_repository.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_bloc.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_event.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_state.dart';

class MockApprovalRepository extends Mock implements ApprovalRepository {}

void main() {
  late MockApprovalRepository mockRepository;
  late ApprovalDetailBloc bloc;

  final sampleRequest = ApprovalRequest(
    approvalId: 'appr-1',
    documentId: 'doc-1',
    documentTitle: 'Invoice 101',
    documentType: 'INVOICE',
    sourceVersion: 'v1.0',
    currentStage: ApprovalStage.tier1,
    status: ApprovalStatus.pending,
    requestedBy: 'user-1',
    requestedAt: DateTime(2026, 1, 1),
    totalAmount: 500.0,
    currency: 'USD',
    requiredApprovals: 1,
    approvalsCount: 0,
    workflowSteps: const [],
    isEligibleApprover: true,
  );

  setUp(() {
    mockRepository = MockApprovalRepository();
    bloc = ApprovalDetailBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('ApprovalDetailBloc Hardening Tests (Duplicate Action Prevention)', () {
    blocTest<ApprovalDetailBloc, ApprovalDetailState>(
      'drops concurrent SubmitApprovalDecisionEvent when isSubmittingDecision is already true',
      seed: () => ApprovalDetailLoaded(
        request: sampleRequest,
        isSubmittingDecision: true,
      ),
      build: () => bloc,
      act: (b) => b.add(const SubmitApprovalDecisionEvent(
        action: ApprovalDecisionAction.approve,
        reasonCode: 'STANDARD',
      )),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.submitApprovalDecision(
              documentId: any(named: 'documentId'),
              action: any(named: 'action'),
              reasonCode: any(named: 'reasonCode'),
              comments: any(named: 'comments'),
              sourceVersion: any(named: 'sourceVersion'),
            ));
      },
    );

    blocTest<ApprovalDetailBloc, ApprovalDetailState>(
      'drops concurrent PublishDocumentToErpEvent when isPublishingErp is already true',
      seed: () => ApprovalDetailLoaded(
        request: sampleRequest,
        isPublishingErp: true,
      ),
      build: () => bloc,
      act: (b) => b.add(const PublishDocumentToErpEvent()),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.publishToErp(
              documentId: any(named: 'documentId'),
              forceRetry: any(named: 'forceRetry'),
            ));
      },
    );
  });
}
