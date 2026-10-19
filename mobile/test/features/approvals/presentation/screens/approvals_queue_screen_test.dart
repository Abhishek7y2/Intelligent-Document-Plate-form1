import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/approvals/domain/entities/approval_item.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_queue/approval_queue_bloc.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_queue/approval_queue_event.dart';
import 'package:docunexa_mobile/features/approvals/presentation/bloc/approval_queue/approval_queue_state.dart';
import 'package:docunexa_mobile/features/approvals/presentation/screens/approvals_queue_screen.dart';

class MockApprovalQueueBloc extends MockBloc<ApprovalQueueEvent, ApprovalQueueState>
    implements ApprovalQueueBloc {}

void main() {
  late MockApprovalQueueBloc mockBloc;

  setUp(() {
    mockBloc = MockApprovalQueueBloc();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: ApprovalsQueueScreen(bloc: mockBloc),
    );
  }

  group('ApprovalsQueueScreen Widget Tests', () {
    testWidgets('renders loading state when state is ApprovalQueueLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(ApprovalQueueLoading());

      await tester.pumpWidget(buildTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('renders empty state when queue is empty', (tester) async {
      when(() => mockBloc.state).thenReturn(const ApprovalQueueLoaded(
        allItems: [],
        filteredItems: [],
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('No Pending Approvals'), findsOneWidget);
      expect(find.textContaining('Enforcing strict Separation of Duties'), findsOneWidget);
    });

    testWidgets('renders approval task cards with tier and stage badges', (tester) async {
      final sampleItems = [
        ApprovalQueueItem(
          id: 'appr-1',
          documentId: 'doc-101',
          tenantId: 'tenant-test',
          documentTitle: 'Invoice ACME Corp',
          documentType: 'INVOICE',
          tier: ApprovalTier.tier2,
          amount: 25000.0,
          currency: '\$',
          submittedBy: 'submitter@test.com',
          status: ApprovalStatus.pending,
          requiredApprovals: 2,
          approvedCount: 0,
          priority: 'High',
          submittedAt: DateTime.parse('2026-10-17T09:00:00Z'),
          sourceVersion: 'v1.0',
        ),
      ];

      when(() => mockBloc.state).thenReturn(ApprovalQueueLoaded(
        allItems: sampleItems,
        filteredItems: sampleItems,
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Invoice ACME Corp'), findsOneWidget);
      expect(find.text('TIER 2'), findsOneWidget);
      expect(find.text('\$25000.00'), findsOneWidget);
      expect(find.text('Stage 1/2'), findsOneWidget);
    });
  });
}
