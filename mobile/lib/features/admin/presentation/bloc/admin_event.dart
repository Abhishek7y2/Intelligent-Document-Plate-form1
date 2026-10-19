import 'package:equatable/equatable.dart';

abstract class AdminEvent extends Equatable {
  const AdminEvent();

  @override
  List<Object?> get props => [];
}

class AdminFetchTelemetryRequested extends AdminEvent {
  const AdminFetchTelemetryRequested();
}

class AdminFetchUsersRequested extends AdminEvent {
  const AdminFetchUsersRequested();
}

class AdminInviteUserRequested extends AdminEvent {
  final String email;
  final String role;

  const AdminInviteUserRequested({required this.email, required this.role});

  @override
  List<Object?> get props => [email, role];
}

class AdminRevokeInvitationRequested extends AdminEvent {
  final String invitationId;

  const AdminRevokeInvitationRequested(this.invitationId);

  @override
  List<Object?> get props => [invitationId];
}

class AdminUpdateUserRoleRequested extends AdminEvent {
  final String userId;
  final String newRole;

  const AdminUpdateUserRoleRequested({required this.userId, required this.newRole});

  @override
  List<Object?> get props => [userId, newRole];
}

class AdminFetchWorkflowRulesRequested extends AdminEvent {
  const AdminFetchWorkflowRulesRequested();
}

class AdminFetchOperationsDlqRequested extends AdminEvent {
  const AdminFetchOperationsDlqRequested();
}

class AdminRetryDlqJobRequested extends AdminEvent {
  final String jobId;

  const AdminRetryDlqJobRequested(this.jobId);

  @override
  List<Object?> get props => [jobId];
}
