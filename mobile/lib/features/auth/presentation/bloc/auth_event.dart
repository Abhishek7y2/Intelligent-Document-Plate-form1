import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

class LoginSubmitted extends AuthEvent {
  final String email;
  final String password;
  final String? tenantId;
  final String? mfaCode;

  const LoginSubmitted({
    required this.email,
    required this.password,
    this.tenantId,
    this.mfaCode,
  });

  @override
  List<Object?> get props => [email, password, tenantId, mfaCode];
}

class OtpRequestSubmitted extends AuthEvent {
  final String email;

  const OtpRequestSubmitted({required this.email});

  @override
  List<Object?> get props => [email];
}

class OtpVerifySubmitted extends AuthEvent {
  final String email;
  final String code;

  const OtpVerifySubmitted({required this.email, required this.code});

  @override
  List<Object?> get props => [email, code];
}

class AcceptInviteSubmitted extends AuthEvent {
  final String token;
  final String password;
  final String fullName;

  const AcceptInviteSubmitted({
    required this.token,
    required this.password,
    required this.fullName,
  });

  @override
  List<Object?> get props => [token, password, fullName];
}

class BiometricUnlockRequested extends AuthEvent {
  const BiometricUnlockRequested();
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

class SessionExpired extends AuthEvent {
  const SessionExpired();
}

class ChangePasswordSubmitted extends AuthEvent {
  final String currentPassword;
  final String newPassword;

  const ChangePasswordSubmitted({
    required this.currentPassword,
    required this.newPassword,
  });

  @override
  List<Object?> get props => [currentPassword, newPassword];
}
