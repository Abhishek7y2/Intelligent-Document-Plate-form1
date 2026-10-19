import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../domain/entities/approval_detail.dart';
import '../../domain/entities/approval_item.dart';
import '../bloc/approval_detail/approval_detail_bloc.dart';
import '../bloc/approval_detail/approval_detail_event.dart';
import '../bloc/approval_detail/approval_detail_state.dart';
import '../widgets/approval_decision_dialog.dart';
import '../widgets/approval_tier_badge.dart';
import '../widgets/erp_publication_card.dart';
import '../widgets/sod_violation_card.dart';

class ApprovalDetailScreen extends StatelessWidget {
  final String documentId;
  final ApprovalDetailBloc? bloc;

  const ApprovalDetailScreen({
    super.key,
    required this.documentId,
    this.bloc,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<ApprovalDetailBloc>.value(
        value: bloc!,
        child: _ApprovalDetailView(documentId: documentId),
      );
    }
    return BlocProvider<ApprovalDetailBloc>(
      create: (_) => sl<ApprovalDetailBloc>()..add(LoadApprovalDetail(documentId)),
      child: _ApprovalDetailView(documentId: documentId),
    );
  }
}

class _ApprovalDetailView extends StatelessWidget {
  final String documentId;

  const _ApprovalDetailView({required this.documentId});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ApprovalDetailBloc, ApprovalDetailState>(
      listener: (context, state) {
        if (state is ApprovalDecisionSuccessState) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                state.result.isFullyApproved
                    ? 'Document fully approved! Dispatched to enterprise ERP.'
                    : 'Approval stage sign-off recorded successfully.',
              ),
              backgroundColor: const Color(0xFF10B981),
            ),
          );
          context.read<ApprovalDetailBloc>().add(LoadApprovalDetail(documentId));
        } else if (state is ApprovalDetailLoaded && state.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage!),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        }
      },
      builder: (context, state) {
        if (state is ApprovalDetailLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (state is ApprovalDetailError) {
          return Scaffold(
            appBar: AppBar(title: const Text('Approval Details')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 56, color: Colors.red),
                    const SizedBox(height: 16),
                    Text(
                      state.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () => context.pop(),
                      child: const Text('Back to Queue'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (state is ApprovalDetailLoaded) {
          return _buildLoadedView(context, state);
        }

        return const Scaffold(body: SizedBox.shrink());
      },
    );
  }

  Widget _buildLoadedView(BuildContext context, ApprovalDetailLoaded state) {
    final req = state.request;
    final isFullyApproved = req.isFullyApproved;

    return Scaffold(
      appBar: AppBar(
        title: Text('Approval: ${req.documentId}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              context.read<ApprovalDetailBloc>().add(LoadApprovalDetail(documentId));
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // Header Card
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    ApprovalTierBadge(tier: req.tier, showDescription: true),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _getStatusBg(req.status),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        req.status.displayName.toUpperCase(),
                        style: TextStyle(
                          color: _getStatusColor(req.status),
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (req.monetaryAmount != null) ...[
                  Text(
                    '${req.currency}${req.monetaryAmount!.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 6),
                ],
                Text(
                  'Source Version: ${req.sourceVersion} • Submitted by: ${req.submittedBy}',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
                if (req.reviewedBy != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Reviewed by: ${req.reviewedBy}',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ],
            ),
          ),

          // SoD Violation Warning if active
          if (state.sodViolationMessage != null)
            SodViolationCard(
              title: 'Separation of Duties Alert',
              message: state.sodViolationMessage!,
              ruleCode: state.sodViolationCode,
            ),

          // Approval Quorum / Multi-Stage Tracker
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'Approval Quorum (${req.approvedCount}/${req.requiredApprovals} Sign-offs)',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ),

          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Column(
              children: List.generate(req.requiredApprovals, (index) {
                final stageNo = index + 1;
                final isSigned = index < req.decisions.length;
                final decision = isSigned ? req.decisions[index] : null;

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isSigned ? const Color(0xFF10B981) : Colors.grey[200],
                      ),
                      child: Center(
                        child: isSigned
                            ? const Icon(Icons.check, size: 16, color: Colors.white)
                            : Text(
                                '$stageNo',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey[600],
                                  fontSize: 12,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isSigned
                                ? 'Stage $stageNo: Signed by ${decision!.approverName}'
                                : 'Stage $stageNo: Awaiting Sign-off',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: isSigned ? Colors.black87 : Colors.grey[600],
                            ),
                          ),
                          if (isSigned) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Role: ${decision!.approverRole} • Reason: ${decision.reasonCode}',
                              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                            ),
                            if (decision.comments != null)
                              Text(
                                '"${decision.comments}"',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontStyle: FontStyle.italic,
                                  color: Colors.black87,
                                ),
                              ),
                            Text(
                              'Hash: ${decision.signatureHash.substring(0, 16)}...',
                              style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                            ),
                          ],
                          if (index < req.requiredApprovals - 1)
                            const Divider(height: 20),
                        ],
                      ),
                    ),
                  ],
                );
              }),
            ),
          ),

          // ERP Outbound Publication Card
          if (isFullyApproved)
            ErpPublicationCard(
              publication: state.erpRecord,
              isPublishing: state.isPublishingErp,
              onPublish: () {
                context.read<ApprovalDetailBloc>().add(
                      PublishDocumentToErpEvent(
                        forceRetry: state.erpRecord?.status == ErpPublicationStatus.failed,
                      ),
                    );
              },
            ),
        ],
      ),
      bottomNavigationBar: !isFullyApproved
          ? _buildDecisionBar(context, state)
          : null,
    );
  }

  Widget _buildDecisionBar(BuildContext context, ApprovalDetailLoaded state) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: state.isSubmittingDecision
                    ? null
                    : () {
                        ApprovalDecisionDialog.show(
                          context,
                          action: ApprovalAction.reject,
                          onConfirm: (reason, comments) {
                            context.read<ApprovalDetailBloc>().add(
                                  SubmitApprovalDecisionEvent(
                                    action: ApprovalAction.reject,
                                    reasonCode: reason,
                                    comments: comments,
                                  ),
                                );
                          },
                        );
                      },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFEF4444),
                  side: const BorderSide(color: Color(0xFFEF4444)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Reject'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                onPressed: state.isSubmittingDecision
                    ? null
                    : () {
                        ApprovalDecisionDialog.show(
                          context,
                          action: ApprovalAction.returnForChanges,
                          onConfirm: (reason, comments) {
                            context.read<ApprovalDetailBloc>().add(
                                  SubmitApprovalDecisionEvent(
                                    action: ApprovalAction.returnForChanges,
                                    reasonCode: reason,
                                    comments: comments,
                                  ),
                                );
                          },
                        );
                      },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFF59E0B),
                  side: const BorderSide(color: Color(0xFFF59E0B)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Return'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: state.isSubmittingDecision
                    ? null
                    : () {
                        ApprovalDecisionDialog.show(
                          context,
                          action: ApprovalAction.approve,
                          onConfirm: (reason, comments) {
                            context.read<ApprovalDetailBloc>().add(
                                  SubmitApprovalDecisionEvent(
                                    action: ApprovalAction.approve,
                                    reasonCode: reason,
                                    comments: comments,
                                  ),
                                );
                          },
                        );
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: state.isSubmittingDecision
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Approve Stage', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(ApprovalStatus status) {
    switch (status) {
      case ApprovalStatus.approved:
        return const Color(0xFF10B981);
      case ApprovalStatus.rejected:
        return const Color(0xFFEF4444);
      case ApprovalStatus.returned:
      case ApprovalStatus.inProgress:
        return const Color(0xFFF59E0B);
      case ApprovalStatus.pending:
        return const Color(0xFF6366F1);
    }
  }

  Color _getStatusBg(ApprovalStatus status) {
    switch (status) {
      case ApprovalStatus.approved:
        return const Color(0xFFECFDF5);
      case ApprovalStatus.rejected:
        return const Color(0xFFFEF2F2);
      case ApprovalStatus.returned:
      case ApprovalStatus.inProgress:
        return const Color(0xFFFEF3C7);
      case ApprovalStatus.pending:
        return const Color(0xFFEEF2FF);
    }
  }
}
