import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/entities/intake_document.dart';
import '../../domain/repositories/intake_repository.dart';
import '../../data/datasources/intake_exceptions.dart';
import 'intake_event.dart';
import 'intake_state.dart';

class IntakeBloc extends Bloc<IntakeEvent, IntakeState> {
  final IntakeRepository _intakeRepository;
  CancelToken? _activeCancelToken;

  IntakeBloc({required IntakeRepository intakeRepository})
      : _intakeRepository = intakeRepository,
        super(const IntakeInitial()) {
    on<IntakePickFileRequested>(_onIntakePickFileRequested);
    on<IntakeScanCameraRequested>(_onIntakeScanCameraRequested);
    on<IntakeDocumentSelected>(_onIntakeDocumentSelected);
    on<IntakeDocumentTypeChanged>(_onIntakeDocumentTypeChanged);
    on<IntakeDocumentRemoved>(_onIntakeDocumentRemoved);
    on<IntakeUploadStarted>(_onIntakeUploadStarted);
    on<IntakeUploadProgressUpdated>(_onIntakeUploadProgressUpdated);
    on<IntakeUploadCancelled>(_onIntakeUploadCancelled);
    on<IntakeReset>(_onIntakeReset);
  }

  Future<void> _onIntakePickFileRequested(
    IntakePickFileRequested event,
    Emitter<IntakeState> emit,
  ) async {
    final previousDocumentType = (state is IntakeDocumentReady)
        ? (state as IntakeDocumentReady).documentType
        : 'purchase-invoice';

    emit(const IntakeSelectingSource());
    try {
      final doc = await _intakeRepository.pickDocumentFile();
      if (doc == null) {
        emit(const IntakeInitial());
        return;
      }

      if (!doc.isValid) {
        emit(IntakeError(
          message: doc.validationError ?? 'Selected file failed pre-upload validation.',
          isRecoverable: false,
        ));
        return;
      }

      emit(IntakeDocumentReady(
        document: doc,
        documentType: previousDocumentType,
      ));
    } on ApiException catch (e) {
      emit(IntakeError(message: e.message, correlationId: e.correlationId));
    } catch (e) {
      emit(IntakeError(message: 'Failed to access file storage: $e'));
    }
  }

  Future<void> _onIntakeScanCameraRequested(
    IntakeScanCameraRequested event,
    Emitter<IntakeState> emit,
  ) async {
    final previousDocumentType = (state is IntakeDocumentReady)
        ? (state as IntakeDocumentReady).documentType
        : 'purchase-invoice';

    emit(const IntakeSelectingSource());
    try {
      final docs = await _intakeRepository.scanDocumentWithCamera();
      if (docs == null || docs.isEmpty) {
        emit(const IntakeInitial());
        return;
      }

      final doc = docs.first;
      if (!doc.isValid) {
        emit(IntakeError(
          message: doc.validationError ?? 'Scanned image failed pre-upload validation.',
          isRecoverable: false,
        ));
        return;
      }

      emit(IntakeDocumentReady(
        document: doc,
        documentType: previousDocumentType,
      ));
    } on ApiException catch (e) {
      emit(IntakeError(message: e.message, correlationId: e.correlationId));
    } catch (e) {
      emit(IntakeError(message: 'Camera scanner unavailable or permission denied: $e'));
    }
  }

  void _onIntakeDocumentSelected(
    IntakeDocumentSelected event,
    Emitter<IntakeState> emit,
  ) {
    if (!event.document.isValid) {
      emit(IntakeError(
        message: event.document.validationError ?? 'Selected document is invalid.',
        isRecoverable: false,
      ));
      return;
    }

    emit(IntakeDocumentReady(document: event.document));
  }

  void _onIntakeDocumentTypeChanged(
    IntakeDocumentTypeChanged event,
    Emitter<IntakeState> emit,
  ) {
    if (state is IntakeDocumentReady) {
      final current = state as IntakeDocumentReady;
      emit(current.copyWith(documentType: event.documentType));
    } else if (state is IntakeDuplicateConflict) {
      final current = state as IntakeDuplicateConflict;
      emit(IntakeDocumentReady(
        document: current.document,
        documentType: event.documentType,
      ));
    }
  }

  void _onIntakeDocumentRemoved(
    IntakeDocumentRemoved event,
    Emitter<IntakeState> emit,
  ) {
    emit(const IntakeInitial());
  }

  Future<void> _onIntakeUploadStarted(
    IntakeUploadStarted event,
    Emitter<IntakeState> emit,
  ) async {
    // Prevent concurrent duplicate upload requests
    if (state is IntakeUploading) return;

    SelectedDocument? document;
    String documentType = 'purchase-invoice';

    if (state is IntakeDocumentReady) {
      final ready = state as IntakeDocumentReady;
      document = ready.document;
      documentType = ready.documentType;
    } else if (state is IntakeDuplicateConflict) {
      final conflict = state as IntakeDuplicateConflict;
      document = conflict.document;
      documentType = conflict.documentType;
    } else if (state is IntakeError) {
      final err = state as IntakeError;
      document = err.document;
      documentType = err.documentType ?? 'purchase-invoice';
    }

    if (document == null) {
      emit(const IntakeError(message: 'No document selected for upload.'));
      return;
    }

    final cancelToken = CancelToken();
    _activeCancelToken = cancelToken;

    emit(IntakeUploading(
      document: document,
      documentType: documentType,
      progress: 0.0,
      sentBytes: 0,
      totalBytes: document.sizeBytes,
      cancelToken: cancelToken,
    ));

    try {
      final result = await _intakeRepository.uploadDocument(
        document: document,
        documentType: documentType,
        allowDuplicate: event.allowDuplicate,
        onProgress: (sent, total) {
          if (!cancelToken.isCancelled) {
            add(IntakeUploadProgressUpdated(sentBytes: sent, totalBytes: total));
          }
        },
        cancelToken: cancelToken,
      );

      _activeCancelToken = null;
      emit(IntakeSuccess(document: document, result: result));
    } on DuplicateDocumentException catch (e) {
      _activeCancelToken = null;
      emit(IntakeDuplicateConflict(
        document: document,
        documentType: documentType,
        existingDocumentId: e.existingDocumentId,
        message: e.message,
      ));
    } on MalwareDetectedException catch (e) {
      _activeCancelToken = null;
      emit(IntakeError(
        message: 'Security Alert: ${e.threatName ?? 'Malware signature'} detected. File was quarantined by the server security pipeline.',
        correlationId: e.correlationId,
        document: document,
        documentType: documentType,
        isRecoverable: false,
      ));
    } on IntakeValidationException catch (e) {
      _activeCancelToken = null;
      emit(IntakeError(
        message: e.message,
        correlationId: e.correlationId,
        document: document,
        documentType: documentType,
        isRecoverable: true,
      ));
    } on ApiException catch (e) {
      _activeCancelToken = null;
      if (cancelToken.isCancelled || e.message.contains('cancelled')) {
        emit(IntakeDocumentReady(document: document, documentType: documentType));
      } else {
        emit(IntakeError(
          message: e.message,
          correlationId: e.correlationId,
          document: document,
          documentType: documentType,
          isRecoverable: true,
        ));
      }
    } catch (e) {
      _activeCancelToken = null;
      emit(IntakeError(
        message: 'Upload error: $e',
        document: document,
        documentType: documentType,
        isRecoverable: true,
      ));
    }
  }

  void _onIntakeUploadProgressUpdated(
    IntakeUploadProgressUpdated event,
    Emitter<IntakeState> emit,
  ) {
    if (state is! IntakeUploading) return;
    final current = state as IntakeUploading;

    final progress = event.totalBytes > 0
        ? (event.sentBytes / event.totalBytes).clamp(0.0, 1.0)
        : 0.0;

    emit(current.copyWith(
      progress: progress,
      sentBytes: event.sentBytes,
      totalBytes: event.totalBytes,
    ));
  }

  void _onIntakeUploadCancelled(
    IntakeUploadCancelled event,
    Emitter<IntakeState> emit,
  ) {
    if (_activeCancelToken != null && !_activeCancelToken!.isCancelled) {
      _activeCancelToken!.cancel('Upload cancelled by user.');
    }
    _activeCancelToken = null;

    if (state is IntakeUploading) {
      final current = state as IntakeUploading;
      emit(IntakeDocumentReady(
        document: current.document,
        documentType: current.documentType,
      ));
    }
  }

  void _onIntakeReset(
    IntakeReset event,
    Emitter<IntakeState> emit,
  ) {
    _activeCancelToken?.cancel();
    _activeCancelToken = null;
    emit(const IntakeInitial());
  }

  @override
  Future<void> close() {
    _activeCancelToken?.cancel();
    return super.close();
  }
}
