import 'package:equatable/equatable.dart';

enum ErpPublicationStatus {
  pending,
  dispatching,
  published,
  failed,
  retrying;

  String get displayName {
    switch (this) {
      case ErpPublicationStatus.pending:
        return 'Pending Dispatch';
      case ErpPublicationStatus.dispatching:
        return 'Dispatching to ERP...';
      case ErpPublicationStatus.published:
        return 'Published (Synced)';
      case ErpPublicationStatus.failed:
        return 'Publication Failed';
      case ErpPublicationStatus.retrying:
        return 'Retrying Dispatch';
    }
  }

  static ErpPublicationStatus fromString(String val) {
    switch (val.toUpperCase()) {
      case 'PENDING':
        return ErpPublicationStatus.pending;
      case 'DISPATCHING':
        return ErpPublicationStatus.dispatching;
      case 'PUBLISHED':
        return ErpPublicationStatus.published;
      case 'FAILED':
        return ErpPublicationStatus.failed;
      case 'RETRYING':
        return ErpPublicationStatus.retrying;
      default:
        return ErpPublicationStatus.pending;
    }
  }
}

class ErpPublicationRecord extends Equatable {
  final String publicationId;
  final String documentId;
  final String tenantId;
  final String erpTarget;
  final String idempotencyKey;
  final ErpPublicationStatus status;
  final int attempts;
  final int? httpStatusCode;
  final String? failureCategory;
  final String? lastError;
  final DateTime? publishedAt;
  final DateTime createdAt;

  const ErpPublicationRecord({
    required this.publicationId,
    required this.documentId,
    required this.tenantId,
    required this.erpTarget,
    required this.idempotencyKey,
    required this.status,
    required this.attempts,
    this.httpStatusCode,
    this.failureCategory,
    this.lastError,
    this.publishedAt,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [
        publicationId,
        documentId,
        tenantId,
        erpTarget,
        idempotencyKey,
        status,
        attempts,
        httpStatusCode,
        failureCategory,
        lastError,
        publishedAt,
        createdAt,
      ];
}

class ErpPublishResult extends Equatable {
  final bool success;
  final String publicationId;
  final ErpPublicationStatus status;
  final int attempts;
  final String idempotencyKey;
  final DateTime? publishedAt;
  final String? error;

  const ErpPublishResult({
    required this.success,
    required this.publicationId,
    required this.status,
    required this.attempts,
    required this.idempotencyKey,
    this.publishedAt,
    this.error,
  });

  @override
  List<Object?> get props => [
        success,
        publicationId,
        status,
        attempts,
        idempotencyKey,
        publishedAt,
        error,
      ];
}
