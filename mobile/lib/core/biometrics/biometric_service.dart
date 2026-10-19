import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

abstract class BiometricService {
  Future<bool> canCheckBiometrics();
  Future<bool> isDeviceSupported();
  Future<List<BiometricType>> getAvailableBiometrics();
  Future<bool> authenticate({required String localizedReason});
}

class BiometricServiceImpl implements BiometricService {
  final LocalAuthentication _auth;

  BiometricServiceImpl({LocalAuthentication? auth})
      : _auth = auth ?? LocalAuthentication();

  @override
  Future<bool> canCheckBiometrics() async {
    try {
      return await _auth.canCheckBiometrics;
    } on PlatformException {
      return false;
    }
  }

  @override
  Future<bool> isDeviceSupported() async {
    try {
      return await _auth.isDeviceSupported();
    } on PlatformException {
      return false;
    }
  }

  @override
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } on PlatformException {
      return const [];
    }
  }

  @override
  Future<bool> authenticate({required String localizedReason}) async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      if (!isSupported) return false;

      final canCheck = await _auth.canCheckBiometrics;
      if (!canCheck) return false;

      return await _auth.authenticate(
        localizedReason: localizedReason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } on PlatformException {
      // Handles user cancellation, passcode fallback, lockout, or hardware failure gracefully
      return false;
    } catch (_) {
      return false;
    }
  }
}
