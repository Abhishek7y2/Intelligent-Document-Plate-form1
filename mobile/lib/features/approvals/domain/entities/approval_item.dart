import 'package:equatable/equatable.dart';

enum ApprovalTier {
  tier1,
  tier2,
  tier3;

  String get displayName {
    switch (this) {
      case ApprovalTier.tier1:
        return 'Tier 1 (<$10k)';
      case ApprovalTier.tier2:
        return 'Tier 2 ($10k-$50k)';
      case ApprovalTier.tier3:
        return 'Tier 3 (>$50k)';
    }
  }

  static ApprovalTier fromString(String tier) {
    switch (tier.toUpperCase()) {
      case 'TIER_1':
        return ApprovalTier.tier1;
      case 'TIER_2':
        return ApprovalTier.tier2;
      case 'TIER_3':
        return ApprovalTier.tier3;
      default:
        return ApprovalTier.tier1;
    }
  }
}

enum ApprovalStatus {
  pending,
  inProgress,
  approved,
  rejected,
  returned;

  String get displayName {
    switch (this) {
      case ApprovalStatus.pending:
        return 'Pending';
      case ApprovalStatus.inProgress:
        return 'In Progress';
      case ApprovalStatus.approved:
        return 'Approved';
      case ApprovalStatus.rejected:
        return 'Rejected';
      case ApprovalStatus.returned:
        return 'Returned for Changes';
    }
  }

  static ApprovalStatus fromString(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return ApprovalStatus.pending;
      case 'IN_PROGRESS':
        return ApprovalStatus.inProgress;
      case 'APPROVED':
        return ApprovalStatus.approved;
      case 'REJECTED':
        return ApprovalStatus.rejected;
      case 'RETURNED':
        return ApprovalStatus.returned;
      default:
        return ApprovalStatus.pending;
    }
  }
}

class ApprovalQueueItem extends Equatable {
  final String id;
  final String documentId;
  final String tenantId;
  final String documentTitle;
  final String documentType;
  final ApprovalTier tier;
  final double? amount;
  final String currency;
  final String submittedBy;
  final String? reviewedBy;
  final ApprovalStatus status;
  final int requiredApprovals;
  final int approvedCount;
  final String priority; // 'High' | 'Medium' | 'Low'
  final DateTime submittedAt;
  final String sourceVersion;

  const ApprovalQueueItem({
    required this.id,
    required this.documentId,
    required this.tenantId,
    required this.documentTitle,
    required this.documentType,
    required this.tier,
    this.amount,
    required this.currency,
    required this.submittedBy,
    this.reviewedBy,
    required this.status,
    required this.requiredApprovals,
    required this.approvedCount,
    required this.priority,
    required this.submittedAt,
    required this.sourceVersion,
  });

  int get currentStage => approvedCount + 1;
  bool get isFullyApproved => approvedCount >= requiredApprovals;

  @override
  List<Object?> get props => [
        id,
        documentId,
        tenantId,
        documentTitle,
        documentType,
        tier,
        amount,
        currency,
        submittedBy,
        reviewedBy,
        status,
        requiredApprovals,
        approvedCount,
        priority,
        submittedAt,
        sourceVersion,
      ];
}
