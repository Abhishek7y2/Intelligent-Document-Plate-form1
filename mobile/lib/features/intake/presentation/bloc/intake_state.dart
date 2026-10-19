import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/intake_document.dart';

abstract class IntakeState extends Equatable {
  const IntakeState();

  @override
  List<Object?> get props => [];
}

class IntakeInitial extends IntakeState {
  const IntakeInitial();
}

class IntakeSelectingSource extends IntakeState {
  const IntakeSelectingSource();
}

class IntakeDocumentReady extends IntakeState {
  final SelectedDocument document;
  final String documentType;

  const IntakeDocumentReady({
    required this.document,
    this.documentType = 'purchase-invoice',
  });

  IntakeDocumentReady copyWith({
    SelectedDocument? document,
    String? documentType,
  }) {
    return IntakeDocumentReady(
      document: document ?? this.document,
      documentType: documentType ?? this.documentType,
    );
  }

  @override
  List<Object?> get props => [document, documentType];
}

class IntakeUploading extends IntakeState {
  final SelectedDocument document;
  final String documentType;
  final double progress; // 0.0 to 1.0
  final int sentBytes;
  final int totalBytes;
  final CancelToken cancelToken;

  const IntakeUploading({
    required this.document,
    required this.documentType,
    required this.progress,
    required this.sentBytes,
    required this.totalBytes,
    required this.cancelToken,
  });

  IntakeUploading copyWith({
    double? progress,
    int? sentBytes,
    int? totalBytes,
  }) {
    return IntakeUploading(
      document: document,
      documentType: documentType,
      progress: progress ?? this.progress,
      sentBytes: sentBytes ?? this.sentBytes,
      totalBytes: totalBytes ?? this.totalBytes,
      cancelToken: cancelToken,
    );
  }

  @override
  List<Object?> get props => [
        document,
        documentType,
        progress,
        sentBytes,
        totalBytes,
        cancelToken,
      ];
}

class IntakeDuplicateConflict extends IntakeState {
  final SelectedDocument document;
  final String documentType;
  final String? existingDocumentId;
  final String message;

  const IntakeDuplicateConflict({
    required this.document,
    required this.documentType,
    this.existingDocumentId,
    required this.message,
  });

  @override
  List<Object?> get props => [
        document,
        documentType,
        existingDocumentId,
        message,
      ];
}

class IntakeSuccess extends IntakeState {
  final SelectedDocument document;
  final IngestionResult result;

  const IntakeSuccess({
    required this.document,
    required this.result,
  });

  @override
  List<Object?> get props => [document, result];
}

class IntakeError extends IntakeState {
  final String message;
  final String? correlationId;
  final SelectedDocument? document;
  final String? documentType;
  final bool isRecoverable;

  const IntakeError({
    required this.message,
    this.correlationId,
    this.document,
    this.documentType,
    this.isRecoverable = true,
  });

  @override
  List<Object?> get props => [
        message,
        correlationId,
        document,
        documentType,
        isRecoverable,
      ];
}
