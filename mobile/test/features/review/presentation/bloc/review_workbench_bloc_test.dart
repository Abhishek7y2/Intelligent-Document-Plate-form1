import 'dart:typed_data';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/review/data/datasources/review_exceptions.dart';
import 'package:docunexa_mobile/features/review/domain/entities/review_workbench.dart';
import 'package:docunexa_mobile/features/review/domain/repositories/review_repository.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_workbench/review_workbench_bloc.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_workbench/review_workbench_event.dart';
import 'package:docunexa_mobile/features/review/presentation/bloc/review_workbench/review_workbench_state.dart';

class MockReviewRepository extends Mock implements ReviewRepository {}

void main() {
  late MockReviewRepository mockRepository;
  late ReviewWorkbenchBloc bloc;

  final sampleWorkbench = ReviewWorkbench(
    documentId: 'doc-123',
    documentTitle: 'Invoice #001',
    documentType: 'INVOICE',
    status: 'NEEDS_REVIEW',
    stage: 'EXTRACTED',
    pages: 2,
    pageDimensions: const [
      PageDimension(page: 1, width: 800, height: 1100),
      PageDimension(page: 2, width: 800, height: 1100),
    ],
    submittedAt: DateTime.parse('2026-10-17T10:00:00Z'),
    overallConfidence: 0.85,
    fields: const [
      ReviewField(
        key: 'invoice_number',
        label: 'Invoice Number',
        value: 'INV-2026',
        confidence: 0.95,
      ),
      ReviewField(
        key: 'line_total',
        label: 'Line Total',
        value: '500.00',
        confidence: 0.80,
      ),
    ],
    boundingBoxes: const [
      ReviewBoundingBox(
        fieldKey: 'invoice_number',
        page: 1,
        x: 0.1,
        y: 0.1,
        w: 0.3,
        h: 0.05,
        confidence: 0.95,
      ),
      ReviewBoundingBox(
        fieldKey: 'line_total',
        page: 2,
        x: 0.2,
        y: 0.5,
        w: 0.2,
        h: 0.05,
        confidence: 0.80,
      ),
    ],
    reconciliationResult: const InvoiceReconciliation(
      netAmount: 500,
      taxAmount: 50,
      totalAmount: 550,
      calculatedTotal: 550,
      mathValid: true,
      discrepancy: 0,
      currency: '\$',
    ),
  );

  setUp(() {
    mockRepository = MockReviewRepository();
    bloc = ReviewWorkbenchBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('ReviewWorkbenchBloc Tests', () {
    test('initial state is ReviewWorkbenchInitial', () {
      expect(bloc.state, isA<ReviewWorkbenchInitial>());
    });

    blocTest<ReviewWorkbenchBloc, ReviewWorkbenchState>(
      'loads workbench and fetches initial page image on LoadReviewWorkbench',
      build: () {
        when(() => mockRepository.getReviewWorkbench('doc-123'))
            .thenAnswer((_) async => sampleWorkbench);
        when(() => mockRepository.getDocumentPageImage('doc-123', 1))
            .thenAnswer((_) async => Uint8List.fromList([1, 2, 3]));
        return bloc;
      },
      act: (b) => b.add(const LoadReviewWorkbench('doc-123')),
      expect: () => [
        isA<ReviewWorkbenchLoading>(),
        isA<ReviewWorkbenchLoaded>()
            .having((s) => s.workbench.documentId, 'documentId', 'doc-123')
            .having((s) => s.currentPage, 'currentPage', 1)
            .having((s) => s.isImageLoading, 'isImageLoading', true),
        isA<ReviewWorkbenchLoaded>()
            .having((s) => s.pageImageBytes, 'pageImageBytes', isNotNull)
            .having((s) => s.isImageLoading, 'isImageLoading', false),
      ],
    );

    blocTest<ReviewWorkbenchBloc, ReviewWorkbenchState>(
      'emits ReviewWorkbenchDecisionSuccess when decision submission succeeds',
      seed: () => ReviewWorkbenchLoaded(workbench: sampleWorkbench),
      build: () {
        when(() => mockRepository.submitReviewDecision(
              documentId: 'doc-123',
              action: 'APPROVE',
              comments: any(named: 'comments'),
              overrideReason: any(named: 'overrideReason'),
            )).thenAnswer((_) async => const ReviewDecisionResult(
              documentId: 'doc-123',
              status: 'APPROVED',
              updatedAt: '2026-10-17T11:30:00Z',
            ));
        return bloc;
      },
      act: (b) => b.add(const SubmitWorkbenchDecision(action: 'APPROVE')),
      expect: () => [
        isA<ReviewWorkbenchLoaded>().having((s) => s.isSubmitting, 'isSubmitting', true),
        isA<ReviewWorkbenchDecisionSuccess>()
            .having((s) => s.result.status, 'status', 'APPROVED'),
      ],
    );

    blocTest<ReviewWorkbenchBloc, ReviewWorkbenchState>(
      'surfaces submitError when decision fails due to InvoiceMathMismatchException',
      seed: () => ReviewWorkbenchLoaded(workbench: sampleWorkbench),
      build: () {
        when(() => mockRepository.submitReviewDecision(
              documentId: 'doc-123',
              action: 'APPROVE',
              comments: any(named: 'comments'),
              overrideReason: any(named: 'overrideReason'),
            )).thenThrow(const InvoiceMathMismatchException(
          'Invoice calculation mismatch. Override reason required.',
        ));
        return bloc;
      },
      act: (b) => b.add(const SubmitWorkbenchDecision(action: 'APPROVE')),
      expect: () => [
        isA<ReviewWorkbenchLoaded>().having((s) => s.isSubmitting, 'isSubmitting', true),
        isA<ReviewWorkbenchLoaded>()
            .having((s) => s.isSubmitting, 'isSubmitting', false)
            .having((s) => s.submitError, 'submitError', contains('Invoice calculation mismatch')),
      ],
    );
  });
}
