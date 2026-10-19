import '../entities/review_task.dart';
import '../entities/review_workbench.dart';

abstract class ReviewRepository {
  /// Fetch all review queue tasks for the current authenticated tenant.
  Future<List<ReviewTaskItem>> getReviewQueue();

  /// Retrieve full aggregated workbench data for a document (fields, evidence bounding boxes, reconciliation).
  Future<ReviewWorkbench> getReviewWorkbenchData(String documentId);

  /// Submit a human reviewer correction to an extracted field value.
  Future<ReviewField> correctField({
    required String documentId,
    required String fieldKey,
    required String correctedValue,
    String? reason,
  });

  /// Submit a workflow transition decision (APPROVE, REJECT, or REQUEST_CHANGES).
  Future<ReviewDecisionResult> submitReviewDecision({
    required String documentId,
    required String action,
    String? comments,
    String? overrideReason,
  });
}
