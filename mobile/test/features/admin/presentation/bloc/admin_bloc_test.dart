import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/admin_telemetry.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/operations_job.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/user_directory_item.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/workflow_rule.dart';
import 'package:docunexa_mobile/features/admin/domain/repositories/admin_repository.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_bloc.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_event.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_state.dart';

class MockAdminRepository extends Mock implements AdminRepository {}

void main() {
  late MockAdminRepository mockRepository;
  late AdminBloc bloc;

  final sampleTelemetry = AdminTelemetry(
    totalDocuments: 1250,
    documentsProcessedToday: 48,
    activeReviewTasks: 12,
    quarantinedDocuments: 2,
    activePoliciesCount: 5,
    systemUptime: '99.98%',
    activeLegalHolds: 3,
    storageUsageBytes: 104857600,
    dlqJobsCount: 4,
    lastRefreshedAt: DateTime(2026, 10, 17, 10, 0, 0),
  );

  final sampleInvitations = [
    UserInvitation(
      invitationId: 'inv-1',
      email: 'alice@docunexa.com',
      role: 'ADMIN',
      status: 'PENDING',
      invitedBy: 'usr-admin-0',
      createdAt: DateTime(2026, 1, 1),
      expiresAt: DateTime(2026, 1, 8),
    ),
  ];

  final sampleRoles = [
    const RoleDetail(
      id: 'role-1',
      name: 'OPERATOR',
      description: 'Operations and queue management',
      permissions: ['ADMIN_ACCESS'],
    ),
  ];

  final sampleRules = [
    WorkflowRule(
      id: 'rule-1',
      name: 'Invoice Auto-Approval',
      description: 'Auto-approves invoices under threshold',
      documentType: 'INVOICE',
      priority: 1,
      isActive: true,
      conditions: const {'amount_max': 500},
      actions: const ['AUTO_APPROVE'],
      updatedAt: DateTime(2026, 10, 1),
    ),
  ];

  final sampleDlqJobs = [
    OperationsJob(
      id: 'job-101',
      queueName: 'ocr_extraction',
      documentId: 'doc-888',
      errorMessage: 'Timeout contacting OCR worker',
      failedAt: DateTime(2026, 10, 17, 9, 30),
      retryCount: 3,
      isRetrying: false,
    ),
  ];

  setUp(() {
    mockRepository = MockAdminRepository();
    bloc = AdminBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('AdminBloc Telemetry Tests', () {
    test('initial state is default AdminState', () {
      expect(bloc.state, const AdminState());
    });

    blocTest<AdminBloc, AdminState>(
      'emits telemetryLoaded when AdminFetchTelemetryRequested succeeds',
      build: () {
        when(() => mockRepository.getTelemetry())
            .thenAnswer((_) async => sampleTelemetry);
        return bloc;
      },
      act: (b) => b.add(const AdminFetchTelemetryRequested()),
      expect: () => [
        const AdminState(isLoadingTelemetry: true),
        AdminState(
          isLoadingTelemetry: false,
          telemetry: sampleTelemetry,
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'emits permission-denied state when AdminFetchTelemetryRequested encounters 403 ForbiddenException',
      build: () {
        when(() => mockRepository.getTelemetry())
            .thenThrow(ForbiddenException('Administrative telemetry is restricted'));
        return bloc;
      },
      act: (b) => b.add(const AdminFetchTelemetryRequested()),
      expect: () => [
        const AdminState(isLoadingTelemetry: true),
        const AdminState(
          isLoadingTelemetry: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Administrative telemetry is restricted to Administrator and Operator roles.',
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'retains previous telemetry and emits errorMessage on refresh failure',
      seed: () => AdminState(telemetry: sampleTelemetry),
      build: () {
        when(() => mockRepository.getTelemetry())
            .thenThrow(ServerException('Internal server error'));
        return bloc;
      },
      act: (b) => b.add(const AdminFetchTelemetryRequested()),
      expect: () => [
        AdminState(
          isLoadingTelemetry: true,
          telemetry: sampleTelemetry,
        ),
        AdminState(
          isLoadingTelemetry: false,
          telemetry: sampleTelemetry,
          errorMessage: 'Internal server error',
        ),
      ],
    );
  });

  group('AdminBloc User Directory Tests', () {
    blocTest<AdminBloc, AdminState>(
      'emits invitations and roles when AdminFetchUsersRequested succeeds',
      build: () {
        when(() => mockRepository.getInvitations())
            .thenAnswer((_) async => sampleInvitations);
        when(() => mockRepository.getRoles())
            .thenAnswer((_) async => sampleRoles);
        return bloc;
      },
      act: (b) => b.add(const AdminFetchUsersRequested()),
      expect: () => [
        const AdminState(isLoadingUsers: true),
        AdminState(
          isLoadingUsers: false,
          invitations: sampleInvitations,
          roles: sampleRoles,
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'emits permission-denied when AdminFetchUsersRequested throws ForbiddenException',
      build: () {
        when(() => mockRepository.getInvitations())
            .thenThrow(ForbiddenException('Forbidden'));
        return bloc;
      },
      act: (b) => b.add(const AdminFetchUsersRequested()),
      expect: () => [
        const AdminState(isLoadingUsers: true),
        const AdminState(
          isLoadingUsers: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'User directory administration requires the USER_MANAGE permission.',
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'invites user and prepends to invitations upon AdminInviteUserRequested',
      build: () {
        when(() => mockRepository.inviteUser(
              email: 'bob@docunexa.com',
              role: 'REVIEWER',
            )).thenAnswer((_) async => sampleInvitations.first);
        return bloc;
      },
      act: (b) => b.add(const AdminInviteUserRequested(
        email: 'bob@docunexa.com',
        role: 'REVIEWER',
      )),
      expect: () => [
        const AdminState(isSubmittingAction: true),
        AdminState(
          isSubmittingAction: false,
          invitations: sampleInvitations,
          successMessage: 'Invitation sent to bob@docunexa.com',
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'revokes invitation successfully upon AdminRevokeInvitationRequested',
      seed: () => AdminState(invitations: sampleInvitations),
      build: () {
        when(() => mockRepository.revokeInvitation('inv-1'))
            .thenAnswer((_) async => true);
        return bloc;
      },
      act: (b) => b.add(const AdminRevokeInvitationRequested('inv-1')),
      expect: () => [
        AdminState(invitations: sampleInvitations, isSubmittingAction: true),
        const AdminState(
          isSubmittingAction: false,
          invitations: [],
          successMessage: 'Invitation revoked successfully',
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'updates user role on AdminUpdateUserRoleRequested',
      build: () {
        when(() => mockRepository.updateUserRole(
              userId: 'usr-1',
              role: 'OPERATOR',
            )).thenAnswer((_) async => true);
        return bloc;
      },
      act: (b) => b.add(const AdminUpdateUserRoleRequested(
        userId: 'usr-1',
        newRole: 'OPERATOR',
      )),
      expect: () => [
        const AdminState(isSubmittingAction: true),
        const AdminState(
          isSubmittingAction: false,
          successMessage: "User 'usr-1' role updated to 'OPERATOR'",
        ),
      ],
    );
  });

  group('AdminBloc Workflow Rules & DLQ Operations', () {
    blocTest<AdminBloc, AdminState>(
      'emits rules when AdminFetchWorkflowRulesRequested succeeds',
      build: () {
        when(() => mockRepository.getWorkflowRules())
            .thenAnswer((_) async => sampleRules);
        return bloc;
      },
      act: (b) => b.add(const AdminFetchWorkflowRulesRequested()),
      expect: () => [
        const AdminState(isLoadingRules: true),
        AdminState(
          isLoadingRules: false,
          rules: sampleRules,
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'emits DLQ jobs when AdminFetchOperationsDlqRequested succeeds',
      build: () {
        when(() => mockRepository.getOperationsDlq())
            .thenAnswer((_) async => sampleDlqJobs);
        return bloc;
      },
      act: (b) => b.add(const AdminFetchOperationsDlqRequested()),
      expect: () => [
        const AdminState(isLoadingDlq: true),
        AdminState(
          isLoadingDlq: false,
          dlqJobs: sampleDlqJobs,
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<AdminBloc, AdminState>(
      'retries dead letter job successfully and removes job from DLQ',
      seed: () => AdminState(dlqJobs: sampleDlqJobs),
      build: () {
        when(() => mockRepository.retryFailedJob('job-101'))
            .thenAnswer((_) async => true);
        return bloc;
      },
      act: (b) => b.add(const AdminRetryDlqJobRequested('job-101')),
      expect: () => [
        AdminState(dlqJobs: sampleDlqJobs, isSubmittingAction: true),
        const AdminState(
          isSubmittingAction: false,
          dlqJobs: [],
          successMessage: "Job 'job-101' requeued for execution",
        ),
      ],
    );
  });
}
