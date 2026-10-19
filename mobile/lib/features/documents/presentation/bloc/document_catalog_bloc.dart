import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/entities/document.dart';
import '../../domain/repositories/document_repository.dart';
import 'document_catalog_event.dart';
import 'document_catalog_state.dart';

class DocumentCatalogBloc
    extends Bloc<DocumentCatalogEvent, DocumentCatalogState> {
  final DocumentRepository _documentRepository;

  DocumentCatalogBloc({required DocumentRepository documentRepository})
      : _documentRepository = documentRepository,
        super(const DocumentCatalogInitial()) {
    on<DocumentsFetchRequested>(_onDocumentsFetchRequested);
    on<DocumentsNextPageRequested>(_onDocumentsNextPageRequested);
    on<DocumentFilterChanged>(_onDocumentFilterChanged);
    on<DocumentsRefreshRequested>(_onDocumentsRefreshRequested);
  }

  Future<void> _onDocumentsFetchRequested(
    DocumentsFetchRequested event,
    Emitter<DocumentCatalogState> emit,
  ) async {
    // Avoid unnecessary refetching if already loaded and not empty
    if (state is DocumentCatalogLoaded) {
      return;
    }

    emit(const DocumentCatalogLoading());
    try {
      const initialFilter = DocumentFilter();
      final result = await _documentRepository.getDocuments(
        page: 1,
        pageSize: 20,
        filter: initialFilter,
      );

      final hasReachedMax = result.pagination.page >= result.pagination.totalPages;

      emit(DocumentCatalogLoaded(
        documents: result.documents,
        pagination: result.pagination,
        filter: initialFilter,
        hasReachedMax: hasReachedMax,
      ));
    } on ApiException catch (e) {
      emit(DocumentCatalogError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(DocumentCatalogError(message: e.toString()));
    }
  }

  Future<void> _onDocumentsNextPageRequested(
    DocumentsNextPageRequested event,
    Emitter<DocumentCatalogState> emit,
  ) async {
    if (state is! DocumentCatalogLoaded) return;
    final currentState = state as DocumentCatalogLoaded;

    // Protection against duplicate pagination requests
    if (currentState.isLoadingMore || currentState.hasReachedMax) {
      return;
    }

    emit(currentState.copyWith(isLoadingMore: true));

    try {
      final nextPage = currentState.pagination.page + 1;
      final result = await _documentRepository.getDocuments(
        page: nextPage,
        pageSize: currentState.pagination.pageSize,
        filter: currentState.filter,
      );

      final allDocs = List<DocumentItem>.from(currentState.documents)
        ..addAll(result.documents);
      final hasReachedMax = result.pagination.page >= result.pagination.totalPages;

      emit(currentState.copyWith(
        documents: allDocs,
        pagination: result.pagination,
        hasReachedMax: hasReachedMax,
        isLoadingMore: false,
      ));
    } on ApiException catch (e) {
      emit(DocumentCatalogError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(DocumentCatalogError(message: e.toString()));
    }
  }

  Future<void> _onDocumentFilterChanged(
    DocumentFilterChanged event,
    Emitter<DocumentCatalogState> emit,
  ) async {
    emit(const DocumentCatalogLoading());

    try {
      final result = await _documentRepository.getDocuments(
        page: 1,
        pageSize: 20,
        filter: event.filter,
      );

      final hasReachedMax = result.pagination.page >= result.pagination.totalPages;

      emit(DocumentCatalogLoaded(
        documents: result.documents,
        pagination: result.pagination,
        filter: event.filter,
        hasReachedMax: hasReachedMax,
        isLoadingMore: false,
      ));
    } on ApiException catch (e) {
      emit(DocumentCatalogError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(DocumentCatalogError(message: e.toString()));
    }
  }

  Future<void> _onDocumentsRefreshRequested(
    DocumentsRefreshRequested event,
    Emitter<DocumentCatalogState> emit,
  ) async {
    final currentFilter = (state is DocumentCatalogLoaded)
        ? (state as DocumentCatalogLoaded).filter
        : const DocumentFilter();

    try {
      final result = await _documentRepository.getDocuments(
        page: 1,
        pageSize: 20,
        filter: currentFilter,
      );

      final hasReachedMax = result.pagination.page >= result.pagination.totalPages;

      emit(DocumentCatalogLoaded(
        documents: result.documents,
        pagination: result.pagination,
        filter: currentFilter,
        hasReachedMax: hasReachedMax,
        isLoadingMore: false,
      ));
    } on ApiException catch (e) {
      emit(DocumentCatalogError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(DocumentCatalogError(message: e.toString()));
    }
  }
}
