import '../entities/qa_entity.dart';

abstract class QaRepository {
  Future<QaAnswerResult> askQuestion({
    required String question,
    String? documentId,
    List<String>? documentIds,
    String? sessionId,
  });

  Future<List<QaAvailableDoc>> getAvailableDocuments();

  Future<CitationVerification> verifyCitation({
    required String documentId,
    required String citationId,
  });

  Future<bool> submitFeedback({
    required String traceId,
    required String feedback, // 'HELPFUL', 'NOT_HELPFUL', 'FLAGGED'
  });
}
