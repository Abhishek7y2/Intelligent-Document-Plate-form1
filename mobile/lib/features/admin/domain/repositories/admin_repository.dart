import '../entities/admin_telemetry.dart';
import '../entities/operations_job.dart';
import '../entities/user_directory_item.dart';
import '../entities/workflow_rule.dart';

abstract class AdminRepository {
  Future<AdminTelemetry> getTelemetry();

  Future<List<UserInvitation>> getInvitations();

  Future<List<RoleDetail>> getRoles();

  Future<UserInvitation> inviteUser({
    required String email,
    required String role,
  });

  Future<bool> revokeInvitation(String invitationId);

  Future<bool> updateUserRole({
    required String userId,
    required String role,
  });

  Future<List<WorkflowRule>> getWorkflowRules();

  Future<List<OperationsJob>> getOperationsDlq();

  Future<bool> retryFailedJob(String id);
}
