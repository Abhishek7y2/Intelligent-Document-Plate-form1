import '../entities/approval_detail.dart';
import '../entities/approval_item.dart';
import '../entities/erp_publication.dart';

abstract class ApprovalRepository {
  Future<List<ApprovalQueueItem>> getApprovalQueue();

  Future<ApprovalRequestDetail> getApprovalDetails(String documentId);

  Future<ApprovalDecisionResult> submitApprovalDecision({
    required String documentId,
    required ApprovalAction action,
    required String reasonCode,
    String? comments,
    String? sourceVersion,
  });

  Future<ErpPublishResult> publishToErp({
    required String documentId,
    bool forceRetry = false,
  });

  Future<ErpPublicationRecord?> getErpPublicationStatus(String documentId);
}
