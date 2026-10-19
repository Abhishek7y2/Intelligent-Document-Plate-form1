import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/auth/domain/entities/user.dart';
import 'package:docunexa_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_state.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late MockAuthRepository mockAuthRepository;

  const testUser = User(
    userId: 'USR-88210',
    email: 'analyst@docunexa.io',
    tenantId: 'TNT-CORP-01',
    fullName: 'Jane Doe',
    role: 'Reviewer',
    permissions: ['DOCUMENT_READ', 'REVIEW_EXECUTE'],
  );

  setUp(() {
    mockAuthRepository = MockAuthRepository();
  });

  group('AuthBloc Tests', () {
    test('initial state is AuthInitial', () {
      final bloc = AuthBloc(authRepository: mockAuthRepository);
      expect(bloc.state, const AuthInitial());
    });

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, Authenticated] when AuthCheckRequested finds valid session',
      build: () {
        when(() => mockAuthRepository.getCurrentUser())
            .thenAnswer((_) async => testUser);
        when(() => mockAuthRepository.isBiometricOptIn())
            .thenAnswer((_) async => false);
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const AuthCheckRequested()),
      expect: () => [
        const AuthLoading(),
        const Authenticated(user: testUser, isBiometricLocked: false),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, Unauthenticated] when AuthCheckRequested finds no session',
      build: () {
        when(() => mockAuthRepository.getCurrentUser())
            .thenAnswer((_) async => null);
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const AuthCheckRequested()),
      expect: () => [
        const AuthLoading(),
        const Unauthenticated(),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, Authenticated] on successful LoginSubmitted',
      build: () {
        when(() => mockAuthRepository.login(
              email: 'analyst@docunexa.io',
              password: 'SecurePassword123!',
              tenantId: 'TNT-CORP-01',
            )).thenAnswer((_) async => const AuthResult(user: testUser));
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const LoginSubmitted(
        email: 'analyst@docunexa.io',
        password: 'SecurePassword123!',
        tenantId: 'TNT-CORP-01',
      )),
      expect: () => [
        const AuthLoading(message: 'Authenticating...'),
        const Authenticated(user: testUser, isBiometricLocked: false),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, MfaRequiredState] when user has MFA enabled',
      build: () {
        when(() => mockAuthRepository.login(
              email: 'analyst@docunexa.io',
              password: 'SecurePassword123!',
            )).thenAnswer((_) async => const AuthResult(
              user: testUser,
              mfaRequired: true,
              mfaMessage: 'TOTP required',
            ));
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const LoginSubmitted(
        email: 'analyst@docunexa.io',
        password: 'SecurePassword123!',
      )),
      expect: () => [
        const AuthLoading(message: 'Authenticating...'),
        const MfaRequiredState(
          email: 'analyst@docunexa.io',
          user: testUser,
          message: 'TOTP required',
        ),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthError] when login fails with invalid credentials',
      build: () {
        when(() => mockAuthRepository.login(
              email: 'bad@docunexa.io',
              password: 'WrongPassword!',
            )).thenThrow(const UnauthorizedApiException(
          message: 'Invalid email or password.',
          statusCode: 401,
          correlationId: 'corr-1234',
        ));
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const LoginSubmitted(
        email: 'bad@docunexa.io',
        password: 'WrongPassword!',
      )),
      expect: () => [
        const AuthLoading(message: 'Authenticating...'),
        const AuthError(
          message: 'Invalid email or password.',
          statusCode: 401,
          correlationId: 'corr-1234',
        ),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, OtpSentState] on OtpRequestSubmitted',
      build: () {
        when(() => mockAuthRepository.requestOtp(email: 'analyst@docunexa.io'))
            .thenAnswer((_) async => const OtpRequestResult(
                  success: true,
                  message: 'OTP sent to email.',
                  email: 'analyst@docunexa.io',
                  expiresInSeconds: 300,
                ));
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const OtpRequestSubmitted(email: 'analyst@docunexa.io')),
      expect: () => [
        const AuthLoading(message: 'Sending one-time passcode...'),
        const OtpSentState(
          email: 'analyst@docunexa.io',
          message: 'OTP sent to email.',
          expiresInSeconds: 300,
        ),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, Authenticated] on OtpVerifySubmitted',
      build: () {
        when(() => mockAuthRepository.verifyOtp(
              email: 'analyst@docunexa.io',
              code: '123456',
            )).thenAnswer((_) async => const AuthResult(user: testUser));
        return AuthBloc(authRepository: mockAuthRepository);
      },
      act: (bloc) => bloc.add(const OtpVerifySubmitted(
        email: 'analyst@docunexa.io',
        code: '123456',
      )),
      expect: () => [
        const AuthLoading(message: 'Verifying passcode...'),
        const Authenticated(user: testUser, isBiometricLocked: false),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, Unauthenticated] on LogoutRequested',
      build: () {
        when(() => mockAuthRepository.logout()).thenAnswer((_) async {});
        return AuthBloc(authRepository: mockAuthRepository);
      },
      seed: () => const Authenticated(user: testUser),
      act: (bloc) => bloc.add(const LogoutRequested()),
      expect: () => [
        const AuthLoading(message: 'Signing out...'),
        const Unauthenticated(),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [Unauthenticated] with message on SessionExpired',
      build: () => AuthBloc(authRepository: mockAuthRepository),
      seed: () => const Authenticated(user: testUser),
      act: (bloc) => bloc.add(const SessionExpired()),
      expect: () => [
        const Unauthenticated(message: 'Your session has expired. Please sign in again.'),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'unlocks biometric lock when BiometricUnlockRequested succeeds',
      build: () {
        when(() => mockAuthRepository.authenticateWithBiometrics())
            .thenAnswer((_) async => true);
        return AuthBloc(authRepository: mockAuthRepository);
      },
      seed: () => const Authenticated(user: testUser, isBiometricLocked: true),
      act: (bloc) => bloc.add(const BiometricUnlockRequested()),
      expect: () => [
        const Authenticated(user: testUser, isBiometricLocked: false),
      ],
    );
  });
}
