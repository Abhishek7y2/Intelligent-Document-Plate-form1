import 'package:equatable/equatable.dart';
import '../../domain/entities/document.dart';

abstract class DocumentCatalogState extends Equatable {
  const DocumentCatalogState();

  @override
  List<Object?> get props => [];
}

class DocumentCatalogInitial extends DocumentCatalogState {
  const DocumentCatalogInitial();
}

class DocumentCatalogLoading extends DocumentCatalogState {
  const DocumentCatalogLoading();
}

class DocumentCatalogLoaded extends DocumentCatalogState {
  final List<DocumentItem> documents;
  final DocumentPagination pagination;
  final DocumentFilter filter;
  final bool hasReachedMax;
  final bool isLoadingMore;

  const DocumentCatalogLoaded({
    required this.documents,
    required this.pagination,
    required this.filter,
    this.hasReachedMax = false,
    this.isLoadingMore = false,
  });

  DocumentCatalogLoaded copyWith({
    List<DocumentItem>? documents,
    DocumentPagination? pagination,
    DocumentFilter? filter,
    bool? hasReachedMax,
    bool? isLoadingMore,
  }) {
    return DocumentCatalogLoaded(
      documents: documents ?? this.documents,
      pagination: pagination ?? this.pagination,
      filter: filter ?? this.filter,
      hasReachedMax: hasReachedMax ?? this.hasReachedMax,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }

  @override
  List<Object?> get props => [
        documents,
        pagination,
        filter,
        hasReachedMax,
        isLoadingMore,
      ];
}

class DocumentCatalogError extends DocumentCatalogState {
  final String message;
  final String? correlationId;

  const DocumentCatalogError({required this.message, this.correlationId});

  @override
  List<Object?> get props => [message, correlationId];
}
