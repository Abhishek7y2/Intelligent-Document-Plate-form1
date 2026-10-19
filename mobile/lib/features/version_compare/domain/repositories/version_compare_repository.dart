import '../entities/document_comparison.dart';
import '../entities/document_version.dart';

abstract class VersionCompareRepository {
  Future<List<DocumentVersionItem>> listDocumentVersions(String documentId);

  Future<DocumentComparisonResult> compareDocuments(String docId1, String docId2);

  Future<DocumentComparisonResult> getComparison(String comparisonId);
}
