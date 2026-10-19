import 'package:bloc_test/bloc_test.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/intake/data/datasources/intake_exceptions.dart';
import 'package:docunexa_mobile/features/intake/data/models/ingestion_result_model.dart';
import 'package:docunexa_mobile/features/intake/domain/entities/intake_document.dart';
import 'package:docunexa_mobile/features/intake/domain/repositories/intake_repository.dart';
import 'package:docunexa_mobile/features/intake/presentation/bloc/intake_bloc.dart';
import 'package:docunexa_mobile/features/intake/presentation/bloc/intake_event.dart';
import 'package:docunexa_mobile/features/intake/presentation/bloc/intake_state.dart';

class MockIntakeRepository extends Mock implements IntakeRepository {}

void main() {
  late MockIntakeRepository mockRepository;

  final sampleValidDoc = SelectedDocument(
    path: '/data/user/0/com.docunexa/app_flutter/invoice_march.pdf',
    name: 'invoice_march.pdf',
    sizeBytes: 204800,
    mimeType: 'application/pdf',
    source: IntakeSource.filePicker,
    isValid: true,
  );

  const sampleResult = IngestionResult(
    documentId: 'DOC-INTAKE-771',
    tenantId: 'TNT-CORP-01',
    fileName: 'invoice_march.pdf',
    fileSizeBytes: 204800,
    sha256Hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    mimeType: 'application/pdf',
    status: 'INGESTED',
    ingestionSource: 'MANUAL_UPLOAD',
    ingestedAt: null as dynamic,
  );

  setUpAll(() {
    registerFallbackValue(sampleValidDoc);
  });

  setUp(() {
    mockRepository = MockIntakeRepository();
  });

  group('IntakeBloc Tests', () {
    test('initial state is IntakeInitial', () {
      final bloc = IntakeBloc(intakeRepository: mockRepository);
      expect(bloc.state, const IntakeInitial());
    });

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeSelectingSource, IntakeDocumentReady] when file picked successfully',
      build: () {
        when(() => mockRepository.pickDocumentFile())
            .thenAnswer((_) async => sampleValidDoc);
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakePickFileRequested()),
      expect: () => [
        const IntakeSelectingSource(),
        IntakeDocumentReady(
          document: sampleValidDoc,
          documentType: 'purchase-invoice',
        ),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeSelectingSource, IntakeInitial] when file picker is cancelled',
      build: () {
        when(() => mockRepository.pickDocumentFile())
            .thenAnswer((_) async => null);
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakePickFileRequested()),
      expect: () => [
        const IntakeSelectingSource(),
        const IntakeInitial(),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeSelectingSource, IntakeError] when file fails pre-validation',
      build: () {
        const invalidDoc = SelectedDocument(
          path: '/corrupt.pdf',
          name: 'corrupt.pdf',
          sizeBytes: 0,
          mimeType: 'application/pdf',
          source: IntakeSource.filePicker,
          isValid: false,
          validationError: 'Selected file is empty (0 bytes).',
        );
        when(() => mockRepository.pickDocumentFile())
            .thenAnswer((_) async => invalidDoc);
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakePickFileRequested()),
      expect: () => [
        const IntakeSelectingSource(),
        const IntakeError(
          message: 'Selected file is empty (0 bytes).',
          isRecoverable: false,
        ),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeSelectingSource, IntakeDocumentReady] when camera scanner completes successfully',
      build: () {
        final scannedDoc = SelectedDocument(
          path: '/camera/scan_001.jpg',
          name: 'scan_001.jpg',
          sizeBytes: 450000,
          mimeType: 'image/jpeg',
          source: IntakeSource.cameraScan,
          isValid: true,
        );
        when(() => mockRepository.scanDocumentWithCamera())
            .thenAnswer((_) async => [scannedDoc]);
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakeScanCameraRequested()),
      expect: () => [
        const IntakeSelectingSource(),
        isA<IntakeDocumentReady>().having(
          (s) => s.document.source,
          'source',
          IntakeSource.cameraScan,
        ),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits updated IntakeDocumentReady when IntakeDocumentTypeChanged is added',
      seed: () => IntakeDocumentReady(
        document: sampleValidDoc,
        documentType: 'purchase-invoice',
      ),
      build: () => IntakeBloc(intakeRepository: mockRepository),
      act: (bloc) => bloc.add(const IntakeDocumentTypeChanged('contract')),
      expect: () => [
        IntakeDocumentReady(
          document: sampleValidDoc,
          documentType: 'contract',
        ),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeUploading, IntakeSuccess] when upload succeeds on 202 response',
      seed: () => IntakeDocumentReady(
        document: sampleValidDoc,
        documentType: 'purchase-invoice',
      ),
      build: () {
        when(() => mockRepository.uploadDocument(
              document: any(named: 'document'),
              documentType: any(named: 'documentType'),
              allowDuplicate: any(named: 'allowDuplicate'),
              onProgress: any(named: 'onProgress'),
              cancelToken: any(named: 'cancelToken'),
            )).thenAnswer((_) async => sampleResult);
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakeUploadStarted()),
      expect: () => [
        isA<IntakeUploading>()
            .having((s) => s.document.name, 'name', 'invoice_march.pdf')
            .having((s) => s.progress, 'progress', 0.0),
        isA<IntakeSuccess>()
            .having((s) => s.result.documentId, 'documentId', 'DOC-INTAKE-771'),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeUploading, IntakeDuplicateConflict] when 409 duplicate detected',
      seed: () => IntakeDocumentReady(
        document: sampleValidDoc,
        documentType: 'purchase-invoice',
      ),
      build: () {
        when(() => mockRepository.uploadDocument(
              document: any(named: 'document'),
              documentType: any(named: 'documentType'),
              allowDuplicate: any(named: 'allowDuplicate'),
              onProgress: any(named: 'onProgress'),
              cancelToken: any(named: 'cancelToken'),
            )).thenThrow(
          const DuplicateDocumentException(
            message: 'Duplicate document collision',
            existingDocumentId: 'DOC-EXISTING-99',
          ),
        );
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakeUploadStarted()),
      expect: () => [
        isA<IntakeUploading>(),
        isA<IntakeDuplicateConflict>()
            .having((s) => s.existingDocumentId, 'existingDocumentId', 'DOC-EXISTING-99')
            .having((s) => s.message, 'message', 'Duplicate document collision'),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'emits [IntakeUploading, IntakeError] when 422 malware detected (unrecoverable)',
      seed: () => IntakeDocumentReady(
        document: sampleValidDoc,
        documentType: 'purchase-invoice',
      ),
      build: () {
        when(() => mockRepository.uploadDocument(
              document: any(named: 'document'),
              documentType: any(named: 'documentType'),
              allowDuplicate: any(named: 'allowDuplicate'),
              onProgress: any(named: 'onProgress'),
              cancelToken: any(named: 'cancelToken'),
            )).thenThrow(
          const MalwareDetectedException(
            message: 'Malware detected',
            threatName: 'EICAR-Test-Signature',
            quarantined: true,
          ),
        );
        return IntakeBloc(intakeRepository: mockRepository);
      },
      act: (bloc) => bloc.add(const IntakeUploadStarted()),
      expect: () => [
        isA<IntakeUploading>(),
        isA<IntakeError>()
            .having((s) => s.isRecoverable, 'isRecoverable', false)
            .having((s) => s.message, 'message', contains('EICAR-Test-Signature')),
      ],
    );

    blocTest<IntakeBloc, IntakeState>(
      'ignores IntakeUploadStarted if already in IntakeUploading state (duplicate prevention)',
      seed: () => IntakeUploading(
        document: sampleValidDoc,
        documentType: 'purchase-invoice',
        progress: 0.5,
        sentBytes: 102400,
        totalBytes: 204800,
        cancelToken: CancelToken(),
      ),
      build: () => IntakeBloc(intakeRepository: mockRepository),
      act: (bloc) => bloc.add(const IntakeUploadStarted()),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.uploadDocument(
              document: any(named: 'document'),
              documentType: any(named: 'documentType'),
            ));
      },
    );

    blocTest<IntakeBloc, IntakeState>(
      'cancels upload and returns to IntakeDocumentReady on IntakeUploadCancelled',
      seed: () => IntakeUploading(
        document: sampleValidDoc,
        documentType: 'purchase-invoice',
        progress: 0.3,
        sentBytes: 61440,
        totalBytes: 204800,
        cancelToken: CancelToken(),
      ),
      build: () => IntakeBloc(intakeRepository: mockRepository),
      act: (bloc) => bloc.add(const IntakeUploadCancelled()),
      expect: () => [
        IntakeDocumentReady(
          document: sampleValidDoc,
          documentType: 'purchase-invoice',
        ),
      ],
    );
  });
}
