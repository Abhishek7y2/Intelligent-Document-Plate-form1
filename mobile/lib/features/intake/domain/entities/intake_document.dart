import 'package:equatable/equatable.dart';

enum IntakeSource {
  cameraScan,
  filePicker,
}

class SelectedDocument extends Equatable {
  final String path;
  final String name;
  final int sizeBytes;
  final String mimeType;
  final IntakeSource source;
  final int pageCount;
  final String? sha256Hash;
  final bool isValid;
  final String? validationError;

  const SelectedDocument({
    required this.path,
    required this.name,
    required this.sizeBytes,
    required this.mimeType,
    required this.source,
    this.pageCount = 1,
    this.sha256Hash,
    this.isValid = true,
    this.validationError,
  });

  String get formattedSize {
    if (sizeBytes < 1024) return '$sizeBytes B';
    if (sizeBytes < 1024 * 1024) {
      return '${(sizeBytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  @override
  List<Object?> get props => [
        path,
        name,
        sizeBytes,
        mimeType,
        source,
        pageCount,
        sha256Hash,
        isValid,
        validationError,
      ];
}

class IngestionResult extends Equatable {
  final String documentId;
  final String tenantId;
  final String fileName;
  final int fileSizeBytes;
  final String sha256Hash;
  final String mimeType;
  final String status;
  final String ingestionSource;
  final DateTime ingestedAt;

  const IngestionResult({
    required this.documentId,
    required this.tenantId,
    required this.fileName,
    required this.fileSizeBytes,
    required this.sha256Hash,
    required this.mimeType,
    required this.status,
    required this.ingestionSource,
    required this.ingestedAt,
  });

  @override
  List<Object?> get props => [
        documentId,
        tenantId,
        fileName,
        fileSizeBytes,
        sha256Hash,
        mimeType,
        status,
        ingestionSource,
        ingestedAt,
      ];
}
