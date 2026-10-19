import 'package:bloc_test/bloc_test.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/theme/app_theme.dart';
import 'package:docunexa_mobile/features/intake/domain/entities/intake_document.dart';
import 'package:docunexa_mobile/features/intake/presentation/bloc/intake_bloc.dart';
import 'package:docunexa_mobile/features/intake/presentation/bloc/intake_event.dart';
import 'package:docunexa_mobile/features/intake/presentation/bloc/intake_state.dart';
import 'package:docunexa_mobile/features/intake/presentation/screens/intake_screen.dart';

class MockIntakeBloc extends MockBloc<IntakeEvent, IntakeState>
    implements IntakeBloc {}

void main() {
  late MockIntakeBloc mockIntakeBloc;

  final sampleDoc = SelectedDocument(
    path: '/mock/path/Contract_2026.pdf',
    name: 'Contract_2026.pdf',
    sizeBytes: 1572864, // 1.5 MB
    mimeType: 'application/pdf',
    source: IntakeSource.filePicker,
    isValid: true,
  );

  final sampleResult = IngestionResult(
    documentId: 'DOC-CONFIRMED-881',
    tenantId: 'TNT-CORP-01',
    fileName: 'Contract_2026.pdf',
    fileSizeBytes: 1572864,
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    mimeType: 'application/pdf',
    status: 'INGESTED',
    ingestionSource: 'MANUAL_UPLOAD',
    ingestedAt: DateTime.now(),
  );

  setUp(() {
    mockIntakeBloc = MockIntakeBloc();
  });

  Widget createWidgetUnderTest() {
    return MaterialApp(
      theme: AppTheme.darkTheme,
      home: IntakeScreen(bloc: mockIntakeBloc),
    );
  }

  group('IntakeScreen Widget Tests', () {
    testWidgets('renders source selection options in IntakeInitial state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(const IntakeInitial());

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Secure Document Intake'), findsOneWidget);
      expect(find.text('Select Document Source'), findsOneWidget);
      expect(find.text('Camera Document Scanner'), findsOneWidget);
      expect(find.text('Digital File Storage'), findsOneWidget);
      expect(find.text('SECURE INGESTION STANDARDS'), findsOneWidget);
      expect(find.byKey(const Key('intake_camera_scan_button')), findsOneWidget);
      expect(find.byKey(const Key('intake_file_picker_button')), findsOneWidget);
    });

    testWidgets('renders loading indicator in IntakeSelectingSource state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(const IntakeSelectingSource());

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Preparing document capture...'), findsOneWidget);
    });

    testWidgets('renders document preview and upload button in IntakeDocumentReady state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(
        IntakeDocumentReady(
          document: sampleDoc,
          documentType: 'purchase-invoice',
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Contract_2026.pdf'), findsOneWidget);
      expect(find.text('Pre-upload integrity verified'), findsOneWidget);
      expect(find.text('Document Classification Type'), findsOneWidget);
      expect(find.text('Purchase Invoice'), findsOneWidget);
      expect(find.byKey(const Key('intake_start_upload_button')), findsOneWidget);
      expect(find.text('Choose Different File'), findsOneWidget);
    });

    testWidgets('renders progress bar and cancel button in IntakeUploading state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(
        IntakeUploading(
          document: sampleDoc,
          documentType: 'purchase-invoice',
          progress: 0.65,
          sentBytes: 1022361,
          totalBytes: 1572864,
          cancelToken: CancelToken(),
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Uploading Document...'), findsOneWidget);
      expect(find.text('Contract_2026.pdf'), findsOneWidget);
      expect(find.text('65% Transmitted'), findsOneWidget);
      expect(find.byKey(const Key('intake_cancel_upload_button')), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
    });

    testWidgets('renders duplicate collision view in IntakeDuplicateConflict state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(
        IntakeDuplicateConflict(
          document: sampleDoc,
          documentType: 'purchase-invoice',
          existingDocumentId: 'DOC-DUPLICATE-ORIGINAL',
          message: 'A document with this content already exists in your tenant.',
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Duplicate Document Detected'), findsOneWidget);
      expect(find.text('Existing Document ID: DOC-DUPLICATE-ORIGINAL'), findsOneWidget);
      expect(find.byKey(const Key('intake_force_duplicate_button')), findsOneWidget);
      expect(find.text('Discard & Choose Another'), findsOneWidget);
    });

    testWidgets('renders success view with document ID in IntakeSuccess state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(
        IntakeSuccess(
          document: sampleDoc,
          result: sampleResult,
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Ingestion Successful!'), findsOneWidget);
      expect(find.text('DOC-CONFIRMED-881'), findsOneWidget);
      expect(find.text('INGESTED'), findsOneWidget);
      expect(find.byKey(const Key('intake_view_catalog_button')), findsOneWidget);
      expect(find.text('Ingest Another Document'), findsOneWidget);
    });

    testWidgets('renders error view with retry action in IntakeError state', (tester) async {
      when(() => mockIntakeBloc.state).thenReturn(
        const IntakeError(
          message: 'Network connection lost during upload transmission.',
          correlationId: 'req-fail-upload-12',
          isRecoverable: true,
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Intake Error'), findsOneWidget);
      expect(find.text('Network connection lost during upload transmission.'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
