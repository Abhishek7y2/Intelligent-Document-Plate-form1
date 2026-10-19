import '../entities/document.dart';

abstract class DocumentRepository {
  Future<DocumentListResult> getDocuments({
    int page = 1,
    int pageSize = 20,
    DocumentFilter? filter,
  });

  Future<DocumentDetail> getDocumentDetail(String documentId);
}
