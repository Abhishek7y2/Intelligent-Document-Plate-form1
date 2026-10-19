import 'package:equatable/equatable.dart';
import 'approval_item.dart';

enum ApprovalAction {
  approve,
  reject,
  returnForChanges;

  String get apiValue {
    switch (this) {
      case ApprovalAction.approve:
        return 'APPROVE';
      case ApprovalAction.reject:
        return 'REJECT';
      case ApprovalAction.returnForChanges:
        return 'RETURN_FOR_CHANGES';
    }
  }

  static ApprovalAction fromString(String val) {
    switch (val.toUpperCase()) {
      case 'APPROVE':
        return ApprovalAction.approve;
      case 'REJECT':
        return ApprovalAction.reject;
      case 'RETURN_FOR_CHANGES':
        return ApprovalAction.returnForChanges;
      default:
        return ApprovalAction.approve;
    }
  }
}

class ApprovalDecisionRecord extends Equatable {
  final String id;
  final String requestId;
  final String documentId;
  final String tenantId;
  final String approverId;
  final String approverName;
  final String approverRole;
  final ApprovalAction decision;
  final String reasonCode;
  final String? comments;
  final String signatureHash;
  final String sourceVersion;
  final DateTime timestamp;

  const ApprovalDecisionRecord({
    required this.id,
    required this.requestId,
    required this.documentId,
    required this.tenantId,
    required this.approverId,
    required this.approverName,
    required this.approverRole,
    required this.decision,
    required this.reasonCode,
    this.comments,
    required this.signatureHash,
    required this.sourceVersion,
    required this.timestamp,
  });

  @override
  List<Object?> get props => [
        id,
        requestId,
        documentId,
        tenantId,
        approverId,
        approverName,
        approverRole,
        decision,
        reasonCode,
        comments,
        signatureHash,
        sourceVersion,
        timestamp,
      ];
}

class ApprovalRequestDetail extends Equatable {
  final String id;
  final String documentId;
  final String tenantId;
  final ApprovalStatus status;
  final ApprovalTier tier;
  final double? monetaryAmount;
  final String currency;
  final int requiredApprovals;
  final int approvedCount;
  final String sourceVersion;
  final String submittedBy;
  final String? reviewedBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<ApprovalDecisionRecord> decisions;

  const ApprovalRequestDetail({
    required this.id,
    required this.documentId,
    required this.tenantId,
    required this.status,
    required this.tier,
    this.monetaryAmount,
    required this.currency,
    required this.requiredApprovals,
    required this.approvedCount,
    required this.sourceVersion,
    required this.submittedBy,
    this.reviewedBy,
    required this.createdAt,
    required this.updatedAt,
    required this.decisions,
  });

  bool get isFullyApproved => approvedCount >= requiredApprovals;
  int get currentStage => approvedCount + 1;

  @override
  List<Object?> get props => [
        id,
        documentId,
        tenantId,
        status,
        tier,
        monetaryAmount,
        currency,
        requiredApprovals,
        approvedCount,
        sourceVersion,
        submittedBy,
        reviewedBy,
        createdAt,
        updatedAt,
        decisions,
      ];
}

class ApprovalDecisionResult extends Equatable {
  final ApprovalRequestDetail request;
  final bool isFullyApproved;
  final bool dispatchedToErp;

  const ApprovalDecisionResult({
    required this.request,
    required this.isFullyApproved,
    this.dispatchedToErp = false,
  });

  @override
  List<Object?> get props => [request, isFullyApproved, dispatchedToErp];
}
