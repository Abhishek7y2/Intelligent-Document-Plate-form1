import '../entities/user.dart';

class AuthResult {
  final User? user;
  final bool mfaRequired;
  final String? mfaMessage;

  const AuthResult({
    this.user,
    this.mfaRequired = false,
    this.mfaMessage,
  });
}

class OtpRequestResult {
  final bool success;
  final String message;
  final String email;
  final int expiresInSeconds;

  const OtpRequestResult({
    required this.success,
    required this.message,
    required this.email,
    required this.expiresInSeconds,
  });
}

abstract class AuthRepository {
  Future<AuthResult> login({
    required String email,
    required String password,
    String? tenantId,
    String? mfaCode,
  });

  Future<OtpRequestResult> requestOtp({required String email});

  Future<AuthResult> verifyOtp({
    required String email,
    required String code,
  });

  Future<User> acceptInvite({
    required String token,
    required String password,
    required String fullName,
  });

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  });

  Future<User?> getCurrentUser();

  Future<void> logout();

  Future<bool> authenticateWithBiometrics();

  Future<bool> isBiometricOptIn();

  Future<void> setBiometricOptIn(bool enabled);

  Future<bool> canUseBiometrics();
}
