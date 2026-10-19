import 'package:equatable/equatable.dart';
import '../../../domain/entities/approval_detail.dart';

abstract class ApprovalDetailEvent extends Equatable {
  const ApprovalDetailEvent();

  @override
  List<Object?> get props => [];
}

class LoadApprovalDetail extends ApprovalDetailEvent {
  final String documentId;

  const LoadApprovalDetail(this.documentId);

  @override
  List<Object?> get props => [documentId];
}

class SubmitApprovalDecisionEvent extends ApprovalDetailEvent {
  final ApprovalAction action;
  final String reasonCode;
  final String? comments;

  const SubmitApprovalDecisionEvent({
    required this.action,
    required this.reasonCode,
    this.comments,
  });

  @override
  List<Object?> get props => [action, reasonCode, comments];
}

class PublishDocumentToErpEvent extends ApprovalDetailEvent {
  final bool forceRetry;

  const PublishDocumentToErpEvent({this.forceRetry = false});

  @override
  List<Object?> get props => [forceRetry];
}

class RefreshErpPublicationStatus extends ApprovalDetailEvent {
  const RefreshErpPublicationStatus();
}
