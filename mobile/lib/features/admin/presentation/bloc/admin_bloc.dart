import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/repositories/admin_repository.dart';
import 'admin_event.dart';
import 'admin_state.dart';

class AdminBloc extends Bloc<AdminEvent, AdminState> {
  final AdminRepository repository;

  AdminBloc({required this.repository}) : super(const AdminState()) {
    on<AdminFetchTelemetryRequested>(_onFetchTelemetry);
    on<AdminFetchUsersRequested>(_onFetchUsers);
    on<AdminInviteUserRequested>(_onInviteUser);
    on<AdminRevokeInvitationRequested>(_onRevokeInvitation);
    on<AdminUpdateUserRoleRequested>(_onUpdateUserRole);
    on<AdminFetchWorkflowRulesRequested>(_onFetchWorkflowRules);
    on<AdminFetchOperationsDlqRequested>(_onFetchOperationsDlq);
    on<AdminRetryDlqJobRequested>(_onRetryDlqJob);
  }

  Future<void> _onFetchTelemetry(
    AdminFetchTelemetryRequested event,
    Emitter<AdminState> emit,
  ) async {
    emit(state.copyWith(isLoadingTelemetry: true, clearError: true));
    try {
      final telemetry = await repository.getTelemetry();
      emit(state.copyWith(
        isLoadingTelemetry: false,
        telemetry: telemetry,
        isPermissionDenied: false,
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isLoadingTelemetry: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Administrative telemetry is restricted to Administrator and Operator roles.',
        ));
      } else {
        emit(state.copyWith(
          isLoadingTelemetry: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }

  Future<void> _onFetchUsers(
    AdminFetchUsersRequested event,
    Emitter<AdminState> emit,
  ) async {
    emit(state.copyWith(isLoadingUsers: true, clearError: true));
    try {
      final invitations = await repository.getInvitations();
      final roles = await repository.getRoles();
      emit(state.copyWith(
        isLoadingUsers: false,
        invitations: invitations,
        roles: roles,
        isPermissionDenied: false,
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isLoadingUsers: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'User directory administration requires the USER_MANAGE permission.',
        ));
      } else {
        emit(state.copyWith(
          isLoadingUsers: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }

  Future<void> _onInviteUser(
    AdminInviteUserRequested event,
    Emitter<AdminState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true, clearSuccess: true));
    try {
      final newInv = await repository.inviteUser(email: event.email, role: event.role);
      final updatedInvs = [newInv, ...state.invitations];
      emit(state.copyWith(
        isSubmittingAction: false,
        invitations: updatedInvs,
        successMessage: 'Invitation sent to ${event.email}',
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onRevokeInvitation(
    AdminRevokeInvitationRequested event,
    Emitter<AdminState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true, clearSuccess: true));
    try {
      final success = await repository.revokeInvitation(event.invitationId);
      if (success) {
        final updatedInvs = state.invitations
            .where((inv) => inv.invitationId != event.invitationId)
            .toList();
        emit(state.copyWith(
          isSubmittingAction: false,
          invitations: updatedInvs,
          successMessage: 'Invitation revoked successfully',
        ));
      } else {
        emit(state.copyWith(
          isSubmittingAction: false,
          errorMessage: 'Invitation not found or already processed.',
        ));
      }
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onUpdateUserRole(
    AdminUpdateUserRoleRequested event,
    Emitter<AdminState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true, clearSuccess: true));
    try {
      await repository.updateUserRole(userId: event.userId, role: event.newRole);
      emit(state.copyWith(
        isSubmittingAction: false,
        successMessage: "User '${event.userId}' role updated to '${event.newRole}'",
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onFetchWorkflowRules(
    AdminFetchWorkflowRulesRequested event,
    Emitter<AdminState> emit,
  ) async {
    emit(state.copyWith(isLoadingRules: true, clearError: true));
    try {
      final rules = await repository.getWorkflowRules();
      emit(state.copyWith(
        isLoadingRules: false,
        rules: rules,
        isPermissionDenied: false,
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isLoadingRules: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Viewing workflow policies requires POLICY_VIEW permission.',
        ));
      } else {
        emit(state.copyWith(
          isLoadingRules: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }

  Future<void> _onFetchOperationsDlq(
    AdminFetchOperationsDlqRequested event,
    Emitter<AdminState> emit,
  ) async {
    emit(state.copyWith(isLoadingDlq: true, clearError: true));
    try {
      final jobs = await repository.getOperationsDlq();
      emit(state.copyWith(
        isLoadingDlq: false,
        dlqJobs: jobs,
        isPermissionDenied: false,
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isLoadingDlq: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Inspecting operations DLQ requires ADMIN_ACCESS permission.',
        ));
      } else {
        emit(state.copyWith(
          isLoadingDlq: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }

  Future<void> _onRetryDlqJob(
    AdminRetryDlqJobRequested event,
    Emitter<AdminState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true, clearSuccess: true));
    try {
      final success = await repository.retryFailedJob(event.jobId);
      if (success) {
        final updatedJobs = state.dlqJobs.where((j) => j.id != event.jobId).toList();
        emit(state.copyWith(
          isSubmittingAction: false,
          dlqJobs: updatedJobs,
          successMessage: "Job '${event.jobId}' requeued for execution",
        ));
      } else {
        emit(state.copyWith(
          isSubmittingAction: false,
          errorMessage: 'Failed to requeue job',
        ));
      }
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }
}
