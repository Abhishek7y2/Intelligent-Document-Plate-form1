import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/profile/domain/entities/user_profile.dart';
import 'package:docunexa_mobile/features/profile/domain/repositories/profile_repository.dart';
import 'package:docunexa_mobile/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:docunexa_mobile/features/profile/presentation/bloc/profile_event.dart';
import 'package:docunexa_mobile/features/profile/presentation/bloc/profile_state.dart';

class MockProfileRepository extends Mock implements ProfileRepository {}

void main() {
  late MockProfileRepository mockProfileRepository;

  const testProfile = UserProfile(
    userId: 'USR-88210',
    tenantId: 'TNT-CORP-01',
    firstName: 'Jane',
    lastName: 'Doe',
    preferredName: 'Jane',
    workEmail: 'analyst@docunexa.io',
    phoneNumber: '+15550142280',
    employeeId: 'DOC-EMP-88210',
    employmentStatus: 'Active',
    designation: 'Senior Document Analyst',
    department: 'Document Operations',
    managerName: 'Ethan Brooks',
    location: 'New York HQ',
    employeeType: 'Full-time',
    dateJoined: '2022-02-12',
    role: 'Reviewer',
    mfaEnabled: true,
    timezone: 'America/New_York',
    language: 'English (US)',
    emailAlerts: true,
    inAppNotifications: true,
  );

  setUp(() {
    mockProfileRepository = MockProfileRepository();
  });

  group('ProfileBloc Tests', () {
    test('initial state is ProfileInitial', () {
      final bloc = ProfileBloc(profileRepository: mockProfileRepository);
      expect(bloc.state, const ProfileInitial());
    });

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileLoading, ProfileLoaded] on ProfileFetchRequested',
      build: () {
        when(() => mockProfileRepository.getProfile())
            .thenAnswer((_) async => testProfile);
        return ProfileBloc(profileRepository: mockProfileRepository);
      },
      act: (bloc) => bloc.add(const ProfileFetchRequested()),
      expect: () => [
        const ProfileLoading(),
        const ProfileLoaded(testProfile),
      ],
    );

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileUpdating, ProfileLoaded] on ProfileUpdateSubmitted',
      build: () {
        final updated = testProfile.copyWith(firstName: 'Janet');
        when(() => mockProfileRepository.updateProfile(
              firstName: 'Janet',
            )).thenAnswer((_) async => updated);
        return ProfileBloc(profileRepository: mockProfileRepository);
      },
      seed: () => const ProfileLoaded(testProfile),
      act: (bloc) => bloc.add(const ProfileUpdateSubmitted(firstName: 'Janet')),
      expect: () => [
        const ProfileUpdating(testProfile),
        ProfileLoaded(testProfile.copyWith(firstName: 'Janet')),
      ],
    );

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileUpdating, ProfileLoaded] on AvatarUploadSubmitted',
      build: () {
        when(() => mockProfileRepository.uploadAvatar(
              fileBytes: any(named: 'fileBytes'),
              filename: 'avatar.png',
              mimeType: 'image/png',
            )).thenAnswer((_) async => '/api/v1/users/profile/avatar/USR-88210.png');
        return ProfileBloc(profileRepository: mockProfileRepository);
      },
      seed: () => const ProfileLoaded(testProfile),
      act: (bloc) => bloc.add(const AvatarUploadSubmitted(
        fileBytes: [1, 2, 3],
        filename: 'avatar.png',
        mimeType: 'image/png',
      )),
      expect: () => [
        const ProfileUpdating(testProfile),
        ProfileLoaded(testProfile.copyWith(avatarUrl: '/api/v1/users/profile/avatar/USR-88210.png')),
      ],
    );

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileLoading, ProfileError] when getProfile fails',
      build: () {
        when(() => mockProfileRepository.getProfile()).thenThrow(
          const ServerApiException(
            message: 'Failed to fetch user profile.',
            statusCode: 500,
            correlationId: 'corr-500',
          ),
        );
        return ProfileBloc(profileRepository: mockProfileRepository);
      },
      act: (bloc) => bloc.add(const ProfileFetchRequested()),
      expect: () => [
        const ProfileLoading(),
        const ProfileError(
          message: 'Failed to fetch user profile.',
          correlationId: 'corr-500',
        ),
      ],
    );
  });
}
