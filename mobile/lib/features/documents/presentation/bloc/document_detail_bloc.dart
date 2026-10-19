import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/repositories/document_repository.dart';
import 'document_detail_event.dart';
import 'document_detail_state.dart';

class DocumentDetailBloc
    extends Bloc<DocumentDetailEvent, DocumentDetailState> {
  final DocumentRepository _documentRepository;

  DocumentDetailBloc({required DocumentRepository documentRepository})
      : _documentRepository = documentRepository,
        super(const DocumentDetailInitial()) {
    on<DocumentDetailFetchRequested>(_onDocumentDetailFetchRequested);
  }

  Future<void> _onDocumentDetailFetchRequested(
    DocumentDetailFetchRequested event,
    Emitter<DocumentDetailState> emit,
  ) async {
    emit(const DocumentDetailLoading());
    try {
      final detail = await _documentRepository.getDocumentDetail(event.documentId);
      emit(DocumentDetailLoaded(detail));
    } on ApiException catch (e) {
      emit(DocumentDetailError(
        message: e.message,
        correlationId: e.correlationId,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      emit(DocumentDetailError(message: e.toString()));
    }
  }
}
