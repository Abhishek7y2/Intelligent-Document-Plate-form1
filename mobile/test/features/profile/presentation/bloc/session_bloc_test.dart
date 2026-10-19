import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/profile/domain/entities/user_session.dart';
import 'package:docunexa_mobile/features/profile/domain/repositories/profile_repository.dart';
import 'package:docunexa_mobile/features/profile/presentation/bloc/session_bloc.dart';
import 'package:docunexa_mobile/features/profile/presentation/bloc/session_event.dart';
import 'package:docunexa_mobile/features/profile/presentation/bloc/session_state.dart';

class MockProfileRepository extends Mock implements ProfileRepository {}

void main() {
  late MockProfileRepository mockProfileRepository;

  const testSessionCurrent = UserSession(
    sessionId: 'sess-001',
    ipAddress: '192.168.1.100',
    userAgent: 'DocuNexa-Mobile/1.0',
    browser: 'DocuNexa Mobile',
    os: 'Android 14',
    createdAt: '2026-10-17T09:00:00Z',
    lastUsedAt: '2026-10-17T11:00:00Z',
    isCurrent: true,
  );

  const testSessionOther = UserSession(
    sessionId: 'sess-002',
    ipAddress: '10.0.0.5',
    userAgent: 'Mozilla/5.0 Chrome/120.0',
    browser: 'Chrome 120',
    os: 'macOS 14',
    createdAt: '2026-10-16T15:00:00Z',
    lastUsedAt: '2026-10-16T18:00:00Z',
    isCurrent: false,
  );

  setUp(() {
    mockProfileRepository = MockProfileRepository();
  });

  group('SessionBloc Tests', () {
    test('initial state is SessionInitial', () {
      final bloc = SessionBloc(profileRepository: mockProfileRepository);
      expect(bloc.state, const SessionInitial());
    });

    blocTest<SessionBloc, SessionState>(
      'emits [SessionLoading, SessionLoaded] on SessionsFetchRequested',
      build: () {
        when(() => mockProfileRepository.listSessions())
            .thenAnswer((_) async => [testSessionCurrent, testSessionOther]);
        return SessionBloc(profileRepository: mockProfileRepository);
      },
      act: (bloc) => bloc.add(const SessionsFetchRequested()),
      expect: () => [
        const SessionLoading(),
        const SessionLoaded([testSessionCurrent, testSessionOther]),
      ],
    );

    blocTest<SessionBloc, SessionState>(
      'emits [SessionRevokedSuccess, SessionLoaded] on SessionRevokeRequested',
      build: () {
        when(() => mockProfileRepository.revokeSession('sess-002'))
            .thenAnswer((_) async {});
        when(() => mockProfileRepository.listSessions())
            .thenAnswer((_) async => [testSessionCurrent]);
        return SessionBloc(profileRepository: mockProfileRepository);
      },
      act: (bloc) => bloc.add(const SessionRevokeRequested('sess-002')),
      expect: () => [
        const SessionRevokedSuccess('Session successfully revoked.'),
        const SessionLoaded([testSessionCurrent]),
      ],
    );

    blocTest<SessionBloc, SessionState>(
      'emits [SessionLoading, SessionError] when listSessions fails',
      build: () {
        when(() => mockProfileRepository.listSessions()).thenThrow(
          const ServerApiException(
            message: 'Unable to retrieve active sessions.',
            statusCode: 500,
            correlationId: 'corr-sess-err',
          ),
        );
        return SessionBloc(profileRepository: mockProfileRepository);
      },
      act: (bloc) => bloc.add(const SessionsFetchRequested()),
      expect: () => [
        const SessionLoading(),
        const SessionError(
          message: 'Unable to retrieve active sessions.',
          correlationId: 'corr-sess-err',
        ),
      ],
    );
  });
}
