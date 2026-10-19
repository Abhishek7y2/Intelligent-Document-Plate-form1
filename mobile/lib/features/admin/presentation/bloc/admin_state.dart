import 'package:equatable/equatable.dart';
import '../../domain/entities/admin_telemetry.dart';
import '../../domain/entities/operations_job.dart';
import '../../domain/entities/user_directory_item.dart';
import '../../domain/entities/workflow_rule.dart';

class AdminState extends Equatable {
  final AdminTelemetry? telemetry;
  final List<UserInvitation> invitations;
  final List<RoleDetail> roles;
  final List<WorkflowRule> rules;
  final List<OperationsJob> dlqJobs;
  final bool isLoadingTelemetry;
  final bool isLoadingUsers;
  final bool isLoadingRules;
  final bool isLoadingDlq;
  final bool isSubmittingAction;
  final bool isPermissionDenied;
  final String? permissionDeniedMessage;
  final String? errorMessage;
  final String? successMessage;

  const AdminState({
    this.telemetry,
    this.invitations = const [],
    this.roles = const [],
    this.rules = const [],
    this.dlqJobs = const [],
    this.isLoadingTelemetry = false,
    this.isLoadingUsers = false,
    this.isLoadingRules = false,
    this.isLoadingDlq = false,
    this.isSubmittingAction = false,
    this.isPermissionDenied = false,
    this.permissionDeniedMessage,
    this.errorMessage,
    this.successMessage,
  });

  AdminState copyWith({
    AdminTelemetry? telemetry,
    List<UserInvitation>? invitations,
    List<RoleDetail>? roles,
    List<WorkflowRule>? rules,
    List<OperationsJob>? dlqJobs,
    bool? isLoadingTelemetry,
    bool? isLoadingUsers,
    bool? isLoadingRules,
    bool? isLoadingDlq,
    bool? isSubmittingAction,
    bool? isPermissionDenied,
    String? permissionDeniedMessage,
    String? errorMessage,
    bool clearError = false,
    String? successMessage,
    bool clearSuccess = false,
  }) {
    return AdminState(
      telemetry: telemetry ?? this.telemetry,
      invitations: invitations ?? this.invitations,
      roles: roles ?? this.roles,
      rules: rules ?? this.rules,
      dlqJobs: dlqJobs ?? this.dlqJobs,
      isLoadingTelemetry: isLoadingTelemetry ?? this.isLoadingTelemetry,
      isLoadingUsers: isLoadingUsers ?? this.isLoadingUsers,
      isLoadingRules: isLoadingRules ?? this.isLoadingRules,
      isLoadingDlq: isLoadingDlq ?? this.isLoadingDlq,
      isSubmittingAction: isSubmittingAction ?? this.isSubmittingAction,
      isPermissionDenied: isPermissionDenied ?? this.isPermissionDenied,
      permissionDeniedMessage: isPermissionDenied == true
          ? (permissionDeniedMessage ?? this.permissionDeniedMessage)
          : null,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }

  @override
  List<Object?> get props => [
        telemetry,
        invitations,
        roles,
        rules,
        dlqJobs,
        isLoadingTelemetry,
        isLoadingUsers,
        isLoadingRules,
        isLoadingDlq,
        isSubmittingAction,
        isPermissionDenied,
        permissionDeniedMessage,
        errorMessage,
        successMessage,
      ];
}
