import 'package:equatable/equatable.dart';

class DocumentItem extends Equatable {
  final String id;
  final String tenantId;
  final String title;
  final String docType;
  final String status;
  final double confidence;
  final String slaStatus;
  final String source;
  final int pages;
  final String size;
  final DateTime uploadedAt;

  const DocumentItem({
    required this.id,
    required this.tenantId,
    required this.title,
    required this.docType,
    required this.status,
    required this.confidence,
    required this.slaStatus,
    required this.source,
    required this.pages,
    required this.size,
    required this.uploadedAt,
  });

  @override
  List<Object?> get props => [
        id,
        tenantId,
        title,
        docType,
        status,
        confidence,
        slaStatus,
        source,
        pages,
        size,
        uploadedAt,
      ];
}

class DocumentDetail extends Equatable {
  final String id;
  final String tenantId;
  final String fileName;
  final String docType;
  final String status;
  final String stage;
  final double confidence;
  final String slaStatus;
  final String? slaDeadline;
  final String source;
  final String? assignedTo;
  final int pageCount;
  final String size;
  final int fileSizeBytes;
  final String mimeType;
  final String sha256Hash;
  final DateTime uploadedAt;
  final DateTime? processedAt;
  final DateTime? completedAt;
  final String? quarantineReason;
  final int retryCount;

  const DocumentDetail({
    required this.id,
    required this.tenantId,
    required this.fileName,
    required this.docType,
    required this.status,
    required this.stage,
    required this.confidence,
    required this.slaStatus,
    this.slaDeadline,
    required this.source,
    this.assignedTo,
    required this.pageCount,
    required this.size,
    required this.fileSizeBytes,
    required this.mimeType,
    required this.sha256Hash,
    required this.uploadedAt,
    this.processedAt,
    this.completedAt,
    this.quarantineReason,
    this.retryCount = 0,
  });

  @override
  List<Object?> get props => [
        id,
        tenantId,
        fileName,
        docType,
        status,
        stage,
        confidence,
        slaStatus,
        slaDeadline,
        source,
        assignedTo,
        pageCount,
        size,
        fileSizeBytes,
        mimeType,
        sha256Hash,
        uploadedAt,
        processedAt,
        completedAt,
        quarantineReason,
        retryCount,
      ];
}

class DocumentPagination extends Equatable {
  final int totalItems;
  final int page;
  final int pageSize;
  final int totalPages;

  const DocumentPagination({
    required this.totalItems,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  @override
  List<Object?> get props => [totalItems, page, pageSize, totalPages];
}

class DocumentFilter extends Equatable {
  final String query;
  final String? status;
  final String? docType;
  final String sortBy;

  const DocumentFilter({
    this.query = '',
    this.status,
    this.docType,
    this.sortBy = 'date_desc',
  });

  DocumentFilter copyWith({
    String? query,
    String? status,
    String? docType,
    String? sortBy,
    bool clearStatus = false,
    bool clearDocType = false,
  }) {
    return DocumentFilter(
      query: query ?? this.query,
      status: clearStatus ? null : (status ?? this.status),
      docType: clearDocType ? null : (docType ?? this.docType),
      sortBy: sortBy ?? this.sortBy,
    );
  }

  @override
  List<Object?> get props => [query, status, docType, sortBy];
}

class DocumentListResult extends Equatable {
  final List<DocumentItem> documents;
  final DocumentPagination pagination;

  const DocumentListResult({
    required this.documents,
    required this.pagination,
  });

  @override
  List<Object?> get props => [documents, pagination];
}
