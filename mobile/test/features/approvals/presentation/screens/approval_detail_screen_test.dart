import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_detail.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_item.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_bloc.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_event.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_detail/approval_detail_state.dart';
import 'package:docunexa_mobile/features/approvals/presentation/screens/approval_detail_screen.dart';

class MockApprovalDetailBloc extends MockBloc<ApprovalDetailEvent, ApprovalDetailState>
    implements ApprovalDetailBloc {}

void main() {
  late MockApprovalDetailBloc mockBloc;

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
    submittedBy: 'submitter@test.com',
    createdAt: DateTime.parse('2026-10-17T09:00:00Z'),
    updatedAt: DateTime.parse('2026-10-17T09:00:00Z'),
    decisions: const [],
  );

  setUp(() {
    mockBloc = MockApprovalDetailBloc();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: ApprovalDetailScreen(
        documentId: 'doc-101',
        bloc: mockBloc,
      ),
    );
  }

  group('ApprovalDetailScreen Widget Tests', () {
    testWidgets('renders loading state when state is ApprovalDetailLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(ApprovalDetailLoading());

      await tester.pumpWidget(buildTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('renders request details, quorum steps, and action bar', (tester) async {
      when(() => mockBloc.state).thenReturn(ApprovalDetailLoaded(
        request: sampleRequest,
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Approval: doc-101'), findsOneWidget);
      expect(find.text('\$25000.00'), findsOneWidget);
      expect(find.text('Approval Quorum (0/2 Sign-offs)'), findsOneWidget);
      expect(find.text('Stage 1: Awaiting Sign-off'), findsOneWidget);
      expect(find.text('Stage 2: Awaiting Sign-off'), findsOneWidget);

      expect(find.widgetWithText(OutlinedButton, 'Reject'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Return'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Approve Stage'), findsOneWidget);
    });

    testWidgets('renders SoD alert card when SoD violation message is active', (tester) async {
      when(() => mockBloc.state).thenReturn(ApprovalDetailLoaded(
        request: sampleRequest,
        sodViolationCode: 'SOD_VIOLATION_SUBMITTER',
        sodViolationMessage: 'You uploaded this document. Submitter cannot approve their own submission.',
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Separation of Duties Alert'), findsOneWidget);
      expect(find.textContaining('You uploaded this document'), findsOneWidget);
      expect(find.text('SOD_VIOLATION_SUBMITTER'), findsOneWidget);
    });
  });
}
