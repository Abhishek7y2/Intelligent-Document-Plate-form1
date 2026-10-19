import 'package:equatable/equatable.dart';

class OperationsJob extends Equatable {
  final String id;
  final String jobId;
  final String failureReason;
  final int retryCount;
  final DateTime timestamp;
  final String documentId;
  final String? mimeType;
  final int? fileSizeBytes;
  final String correlationId;

  const OperationsJob({
    required this.id,
    required this.jobId,
    required this.failureReason,
    required this.retryCount,
    required this.timestamp,
    required this.documentId,
    this.mimeType,
    this.fileSizeBytes,
    required this.correlationId,
  });

  @override
  List<Object?> get props => [
        id,
        jobId,
        failureReason,
        retryCount,
        timestamp,
        documentId,
        mimeType,
        fileSizeBytes,
        correlationId,
      ];
}
