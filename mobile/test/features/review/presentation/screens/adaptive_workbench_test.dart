import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/review/domain/entities/review_workbench.dart';
import 'package:mobile/features/review/presentation/bloc/review_workbench/review_workbench_bloc.dart';
import 'package:mobile/features/review/presentation/bloc/review_workbench/review_workbench_state.dart';
import 'package:mobile/features/review/presentation/screens/review_workbench_screen.dart';

class FakeReviewWorkbenchBloc extends Fake implements ReviewWorkbenchBloc {
  final ReviewWorkbenchLoaded loadedState;

  FakeReviewWorkbenchBloc(this.loadedState);

  @override
  ReviewWorkbenchState get state => loadedState;

  @override
  Stream<ReviewWorkbenchState> get stream => Stream.value(loadedState);

  @override
  Future<void> close() async {}
}

void main() {
  group('ReviewWorkbenchScreen Adaptive Layout Tests (Angular Parity)', () {
    late ReviewWorkbench testWorkbench;
    late ReviewWorkbenchLoaded testLoadedState;

    setUp(() {
      testWorkbench = const ReviewWorkbench(
        documentId: 'doc-1024',
        documentTitle: 'INV-2026-904 Acme Supply.pdf',
        documentType: 'Purchase Invoice',
        overallConfidence: 0.94,
        totalPages: 2,
        currentPage: 1,
        pageImageUrl: 'http://localhost:8080/api/v1/documents/doc-1024/pages/1/image',
        fields: [
          ExtractedField(
            key: 'invoice_number',
            label: 'Invoice Number',
            value: 'INV-90412',
            confidence: 0.98,
            status: FieldStatus.extracted,
            page: 1,
            coordinates: [10, 10, 200, 50],
          ),
        ],
        reconciliation: MathReconciliation(
          netAmount: 1000.0,
          taxAmount: 100.0,
          totalAmount: 1100.0,
          isBalanced: true,
          calculatedTotal: 1100.0,
          discrepancy: 0.0,
        ),
      );

      testLoadedState = ReviewWorkbenchLoaded(
        workbench: testWorkbench,
        currentPage: 1,
        pageImageBytes: Uint8List(0),
        boundingBoxes: const [],
      );
    });

    testWidgets('renders horizontal 50/50 split canvas on tablet/desktop viewports (>= 768dp)', (tester) async {
      // Set viewport to iPad / Tablet width 1024x768
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeBloc = FakeReviewWorkbenchBloc(testLoadedState);

      await tester.pumpWidget(
        MaterialApp(
          home: ReviewWorkbenchScreen(
            documentId: 'doc-1024',
            bloc: fakeBloc,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // On tablet/desktop (>= 768dp), a horizontal Row with VerticalDivider separates canvas and fields
      expect(find.byType(VerticalDivider), findsOneWidget);
      expect(find.text('INV-2026-904 Acme Supply.pdf'), findsOneWidget);
      expect(find.text('Invoice Number'), findsOneWidget);
      expect(find.text('Approve Document'), findsOneWidget);
    });

    testWidgets('renders vertical stacked split on phone viewports (< 768dp)', (tester) async {
      // Set viewport to Phone width 390x844
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeBloc = FakeReviewWorkbenchBloc(testLoadedState);

      await tester.pumpWidget(
        MaterialApp(
          home: ReviewWorkbenchScreen(
            documentId: 'doc-1024',
            bloc: fakeBloc,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // On phone (< 768dp), vertical layout without VerticalDivider
      expect(find.byType(VerticalDivider), findsNothing);
      expect(find.text('INV-2026-904 Acme Supply.pdf'), findsOneWidget);
      expect(find.text('Invoice Number'), findsOneWidget);
    });
  });
}
