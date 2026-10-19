import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/review/domain/entities/review_workbench.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_workbench/review_workbench_bloc.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_workbench/review_workbench_event.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_workbench/review_workbench_state.dart';
import 'package:docunexa_mobile/features/review/presentation/screens/review_workbench_screen.dart';

class MockReviewWorkbenchBloc
    extends MockBloc<ReviewWorkbenchEvent, ReviewWorkbenchState>
    implements ReviewWorkbenchBloc {}

void main() {
  late MockReviewWorkbenchBloc mockBloc;

  final sampleWorkbench = ReviewWorkbench(
    documentId: 'doc-101',
    documentTitle: 'Invoice ACME Global',
    documentType: 'INVOICE',
    status: 'NEEDS_REVIEW',
    stage: 'EXTRACTED',
    pages: 1,
    pageDimensions: const [
      PageDimension(page: 1, width: 800, height: 1100),
    ],
    submittedAt: DateTime.parse('2026-10-17T09:00:00Z'),
    overallConfidence: 0.82,
    fields: const [
      ReviewField(
        key: 'vendor_name',
        label: 'Vendor Name',
        value: 'ACME Corporation',
        confidence: 0.94,
      ),
      ReviewField(
        key: 'total_amount',
        label: 'Total Amount',
        value: '1150.00',
        confidence: 0.65, // low confidence
      ),
    ],
    boundingBoxes: const [
      ReviewBoundingBox(
        fieldKey: 'vendor_name',
        page: 1,
        x: 0.1,
        y: 0.1,
        w: 0.4,
        h: 0.05,
        confidence: 0.94,
      ),
      ReviewBoundingBox(
        fieldKey: 'total_amount',
        page: 1,
        x: 0.7,
        y: 0.8,
        w: 0.2,
        h: 0.05,
        confidence: 0.65,
      ),
    ],
    reconciliationResult: const InvoiceReconciliation(
      netAmount: 1000.0,
      taxAmount: 150.0,
      totalAmount: 1150.0,
      calculatedTotal: 1150.0,
      mathValid: true,
      discrepancy: 0.0,
      currency: '\$',
    ),
  );

  setUp(() {
    mockBloc = MockReviewWorkbenchBloc();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: ReviewWorkbenchScreen(
        documentId: 'doc-101',
        bloc: mockBloc,
      ),
    );
  }

  group('ReviewWorkbenchScreen Widget Tests', () {
    testWidgets('renders loading state when ReviewWorkbenchLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(ReviewWorkbenchLoading());

      await tester.pumpWidget(buildTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading Review Workbench...'), findsOneWidget);
    });

    testWidgets('renders quarantined error view when document is quarantined', (tester) async {
      when(() => mockBloc.state).thenReturn(const ReviewWorkbenchError(
        message: 'Security quarantine triggered. File contains flagged signature.',
        errorCode: 'DOCUMENT_QUARANTINED',
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Document Quarantined'), findsOneWidget);
      expect(find.textContaining('Security quarantine triggered'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Return to Queue'), findsOneWidget);
    });

    testWidgets('renders review workbench with preview, math card, fields, and action buttons', (tester) async {
      when(() => mockBloc.state).thenReturn(ReviewWorkbenchLoaded(
        workbench: sampleWorkbench,
        currentPage: 1,
        selectedFieldKey: 'vendor_name',
      ));

      await tester.pumpWidget(buildTestWidget());

      // Header info
      expect(find.text('Invoice ACME Global'), findsOneWidget);
      expect(find.text('INVOICE • 82% Confidence'), findsOneWidget);

      // Math Reconciliation Card
      expect(find.text('Math Reconciled (Verified)'), findsOneWidget);
      expect(find.text('BALANCED'), findsOneWidget);

      // Extracted fields
      expect(find.text('Vendor Name'), findsOneWidget);
      expect(find.text('ACME Corporation'), findsOneWidget);
      expect(find.text('Total Amount'), findsOneWidget);
      expect(find.text('1150.00'), findsOneWidget);

      // Decision buttons
      expect(find.widgetWithText(OutlinedButton, 'Reject'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Req Changes'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Approve'), findsOneWidget);
    });
  });
}
