import 'package:equatable/equatable.dart';
import '../../../domain/entities/approval_detail.dart';
import '../../../domain/entities/erp_publication.dart';

abstract class ApprovalDetailState extends Equatable {
  const ApprovalDetailState();

  @override
  List<Object?> get props => [];
}

class ApprovalDetailInitial extends ApprovalDetailState {}

class ApprovalDetailLoading extends ApprovalDetailState {}

class ApprovalDetailLoaded extends ApprovalDetailState {
  final ApprovalRequestDetail request;
  final ErpPublicationRecord? erpRecord;
  final bool isSubmittingDecision;
  final bool isPublishingErp;
  final String? errorMessage;
  final String? sodViolationCode;
  final String? sodViolationMessage;

  const ApprovalDetailLoaded({
    required this.request,
    this.erpRecord,
    this.isSubmittingDecision = false,
    this.isPublishingErp = false,
    this.errorMessage,
    this.sodViolationCode,
    this.sodViolationMessage,
  });

  ApprovalDetailLoaded copyWith({
    ApprovalRequestDetail? request,
    ErpPublicationRecord? erpRecord,
    bool? isSubmittingDecision,
    bool? isPublishingErp,
    String? errorMessage,
    String? sodViolationCode,
    String? sodViolationMessage,
    bool clearErrors = false,
  }) {
    return ApprovalDetailLoaded(
      request: request ?? this.request,
      erpRecord: erpRecord ?? this.erpRecord,
      isSubmittingDecision: isSubmittingDecision ?? this.isSubmittingDecision,
      isPublishingErp: isPublishingErp ?? this.isPublishingErp,
      errorMessage: clearErrors ? null : (errorMessage ?? this.errorMessage),
      sodViolationCode: clearErrors ? null : (sodViolationCode ?? this.sodViolationCode),
      sodViolationMessage: clearErrors ? null : (sodViolationMessage ?? this.sodViolationMessage),
    );
  }

  @override
  List<Object?> get props => [
        request,
        erpRecord,
        isSubmittingDecision,
        isPublishingErp,
        errorMessage,
        sodViolationCode,
        sodViolationMessage,
      ];
}

class ApprovalDecisionSuccessState extends ApprovalDetailState {
  final ApprovalDecisionResult result;

  const ApprovalDecisionSuccessState(this.result);

  @override
  List<Object?> get props => [result];
}

class ApprovalDetailError extends ApprovalDetailState {
  final String message;
  final String? errorCode;

  const ApprovalDetailError(this.message, {this.errorCode});

  @override
  List<Object?> get props => [message, errorCode];
}
