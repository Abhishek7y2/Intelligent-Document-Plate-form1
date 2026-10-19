import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/operations_job.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/user_directory_item.dart';
import 'package:docunexa_mobile/features/admin/domain/repositories/admin_repository.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_bloc.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_event.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_state.dart';

class MockAdminRepository extends Mock implements AdminRepository {}

void main() {
  late MockAdminRepository mockRepository;
  late AdminBloc bloc;

  final sampleJobs = [
    OperationsJob(
      id: 'job-555',
      queueName: 'ocr_extraction',
      documentId: 'doc-99',
      errorMessage: 'Timeout error',
      failedAt: DateTime(2026, 10, 17, 9, 0),
      retryCount: 2,
    ),
  ];

  setUp(() {
    mockRepository = MockAdminRepository();
    bloc = AdminBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('AdminBloc Hardening Tests (Duplicate Action Prevention)', () {
    blocTest<AdminBloc, AdminState>(
      'ignores AdminRetryDlqJobRequested when isSubmittingAction is already true',
      seed: () => AdminState(
        dlqJobs: sampleJobs,
        isSubmittingAction: true,
      ),
      build: () => bloc,
      act: (b) => b.add(const AdminRetryDlqJobRequested('job-555')),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.retryFailedJob(any()));
      },
    );

    blocTest<AdminBloc, AdminState>(
      'ignores AdminInviteUserRequested when isSubmittingAction is already true',
      seed: () => const AdminState(isSubmittingAction: true),
      build: () => bloc,
      act: (b) => b.add(const AdminInviteUserRequested(
        email: 'duplicate@docunexa.com',
        role: 'REVIEWER',
      )),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.inviteUser(
              email: any(named: 'email'),
              role: any(named: 'role'),
            ));
      },
    );

    blocTest<AdminBloc, AdminState>(
      'ignores AdminRevokeInvitationRequested when isSubmittingAction is already true',
      seed: () => const AdminState(isSubmittingAction: true),
      build: () => bloc,
      act: (b) => b.add(const AdminRevokeInvitationRequested('inv-99')),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.revokeInvitation(any()));
      },
    );

    blocTest<AdminBloc, AdminState>(
      'ignores AdminUpdateUserRoleRequested when isSubmittingAction is already true',
      seed: () => const AdminState(isSubmittingAction: true),
      build: () => bloc,
      act: (b) => b.add(const AdminUpdateUserRoleRequested(
        userId: 'usr-1',
        newRole: 'ADMIN',
      )),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.updateUserRole(
              userId: any(named: 'userId'),
              role: any(named: 'role'),
            ));
      },
    );
  });
}
