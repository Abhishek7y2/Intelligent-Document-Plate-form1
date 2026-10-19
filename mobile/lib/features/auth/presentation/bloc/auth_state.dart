import 'package:equatable/equatable.dart';
import '../../domain/entities/user.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  final String? message;
  const AuthLoading({this.message});

  @override
  List<Object?> get props => [message];
}

class Authenticated extends AuthState {
  final User user;
  final bool isBiometricLocked;

  const Authenticated({
    required this.user,
    this.isBiometricLocked = false,
  });

  Authenticated copyWith({
    User? user,
    bool? isBiometricLocked,
  }) {
    return Authenticated(
      user: user ?? this.user,
      isBiometricLocked: isBiometricLocked ?? this.isBiometricLocked,
    );
  }

  @override
  List<Object?> get props => [user, isBiometricLocked];
}

class Unauthenticated extends AuthState {
  final String? message;

  const Unauthenticated({this.message});

  @override
  List<Object?> get props => [message];
}

class MfaRequiredState extends AuthState {
  final String email;
  final User? user;
  final String? message;

  const MfaRequiredState({
    required this.email,
    this.user,
    this.message,
  });

  @override
  List<Object?> get props => [email, user, message];
}

class OtpSentState extends AuthState {
  final String email;
  final String message;
  final int expiresInSeconds;

  const OtpSentState({
    required this.email,
    required this.message,
    required this.expiresInSeconds,
  });

  @override
  List<Object?> get props => [email, message, expiresInSeconds];
}

class AuthError extends AuthState {
  final String message;
  final String? correlationId;
  final int? statusCode;

  const AuthError({
    required this.message,
    this.correlationId,
    this.statusCode,
  });

  @override
  List<Object?> get props => [message, correlationId, statusCode];
}

class PasswordChangeSuccess extends AuthState {
  final String message;

  const PasswordChangeSuccess({required this.message});

  @override
  List<Object?> get props => [message];
}

class InviteAcceptedSuccess extends AuthState {
  final User user;

  const InviteAcceptedSuccess({required this.user});

  @override
  List<Object?> get props => [user];
}
