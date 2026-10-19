import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _authRepository;

  AuthBloc({required AuthRepository authRepository})
      : _authRepository = authRepository,
        super(const AuthInitial()) {
    on<AuthCheckRequested>(_onAuthCheckRequested);
    on<LoginSubmitted>(_onLoginSubmitted);
    on<OtpRequestSubmitted>(_onOtpRequestSubmitted);
    on<OtpVerifySubmitted>(_onOtpVerifySubmitted);
    on<AcceptInviteSubmitted>(_onAcceptInviteSubmitted);
    on<BiometricUnlockRequested>(_onBiometricUnlockRequested);
    on<LogoutRequested>(_onLogoutRequested);
    on<SessionExpired>(_onSessionExpired);
    on<ChangePasswordSubmitted>(_onChangePasswordSubmitted);
  }

  Future<void> _onAuthCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final user = await _authRepository.getCurrentUser();
      if (user != null) {
        final hasBiometrics = await _authRepository.isBiometricOptIn();
        if (hasBiometrics) {
          emit(Authenticated(user: user, isBiometricLocked: true));
        } else {
          emit(Authenticated(user: user, isBiometricLocked: false));
        }
      } else {
        emit(const Unauthenticated());
      }
    } catch (_) {
      emit(const Unauthenticated());
    }
  }

  Future<void> _onLoginSubmitted(
    LoginSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading(message: 'Authenticating...'));
    try {
      final result = await _authRepository.login(
        email: event.email,
        password: event.password,
        tenantId: event.tenantId,
        mfaCode: event.mfaCode,
      );

      if (result.mfaRequired) {
        emit(MfaRequiredState(
          email: event.email,
          user: result.user,
          message: result.mfaMessage ?? 'Please provide your 6-digit TOTP verification code.',
        ));
        return;
      }

      if (result.user != null) {
        emit(Authenticated(user: result.user!, isBiometricLocked: false));
      } else {
        emit(const AuthError(message: 'Authentication completed but user profile was empty.'));
      }
    } on ApiException catch (e) {
      emit(AuthError(
        message: e.message,
        correlationId: e.correlationId,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onOtpRequestSubmitted(
    OtpRequestSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading(message: 'Sending one-time passcode...'));
    try {
      final result = await _authRepository.requestOtp(email: event.email);
      emit(OtpSentState(
        email: result.email,
        message: result.message,
        expiresInSeconds: result.expiresInSeconds,
      ));
    } on ApiException catch (e) {
      emit(AuthError(
        message: e.message,
        correlationId: e.correlationId,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onOtpVerifySubmitted(
    OtpVerifySubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading(message: 'Verifying passcode...'));
    try {
      final result = await _authRepository.verifyOtp(
        email: event.email,
        code: event.code,
      );

      if (result.user != null) {
        emit(Authenticated(user: result.user!, isBiometricLocked: false));
      } else {
        emit(const AuthError(message: 'Verification succeeded but user profile was not returned.'));
      }
    } on ApiException catch (e) {
      emit(AuthError(
        message: e.message,
        correlationId: e.correlationId,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onAcceptInviteSubmitted(
    AcceptInviteSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading(message: 'Accepting organization invitation...'));
    try {
      final user = await _authRepository.acceptInvite(
        token: event.token,
        password: event.password,
        fullName: event.fullName,
      );
      emit(InviteAcceptedSuccess(user: user));
    } on ApiException catch (e) {
      emit(AuthError(
        message: e.message,
        correlationId: e.correlationId,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onBiometricUnlockRequested(
    BiometricUnlockRequested event,
    Emitter<AuthState> emit,
  ) async {
    if (state is Authenticated) {
      final currentState = state as Authenticated;
      final unlocked = await _authRepository.authenticateWithBiometrics();
      if (unlocked) {
        emit(currentState.copyWith(isBiometricLocked: false));
      } else {
        // Biometric failed or was cancelled; keep locked
        emit(currentState.copyWith(isBiometricLocked: true));
      }
    }
  }

  Future<void> _onLogoutRequested(
    LogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading(message: 'Signing out...'));
    await _authRepository.logout();
    emit(const Unauthenticated());
  }

  void _onSessionExpired(
    SessionExpired event,
    Emitter<AuthState> emit,
  ) {
    emit(const Unauthenticated(message: 'Your session has expired. Please sign in again.'));
  }

  Future<void> _onChangePasswordSubmitted(
    ChangePasswordSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    final currentState = state;
    emit(const AuthLoading(message: 'Updating password...'));
    try {
      await _authRepository.changePassword(
        currentPassword: event.currentPassword,
        newPassword: event.newPassword,
      );
      emit(const PasswordChangeSuccess(message: 'Password updated successfully.'));
      // Restore previous state after message emission
      if (currentState is Authenticated) {
        emit(currentState);
      }
    } on ApiException catch (e) {
      emit(AuthError(
        message: e.message,
        correlationId: e.correlationId,
        statusCode: e.statusCode,
      ));
      if (currentState is Authenticated) {
        emit(currentState);
      }
    } catch (e) {
      emit(AuthError(message: e.toString()));
      if (currentState is Authenticated) {
        emit(currentState);
      }
    }
  }
}
