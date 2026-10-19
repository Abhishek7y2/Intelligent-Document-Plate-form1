import 'package:dio/dio.dart';
import '../entities/intake_document.dart';

abstract class IntakeRepository {
  /// Open device file picker to select a single supported document (PDF, DOCX, PNG, JPEG, TIFF).
  Future<SelectedDocument?> pickDocumentFile();

  /// Launch native camera document scanner for edge detection and scanning.
  Future<List<SelectedDocument>?> scanDocumentWithCamera();

  /// Pre-validate file size, extension, and magic bytes before uploading.
  Future<SelectedDocument> prevalidateDocument(String filePath, IntakeSource source);

  /// Securely upload document via multipart POST to `/api/v1/documents/upload`.
  Future<IngestionResult> uploadDocument({
    required SelectedDocument document,
    required String documentType,
    bool allowDuplicate = false,
    void Function(int sentBytes, int totalBytes)? onProgress,
    CancelToken? cancelToken,
  });
}
