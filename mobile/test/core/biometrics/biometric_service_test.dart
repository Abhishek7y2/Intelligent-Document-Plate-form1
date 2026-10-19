import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/biometrics/biometric_service.dart';

class MockLocalAuthentication extends Mock implements LocalAuthentication {}

void main() {
  late MockLocalAuthentication mockLocalAuth;
  late BiometricServiceImpl biometricService;

  setUp(() {
    mockLocalAuth = MockLocalAuthentication();
    biometricService = BiometricServiceImpl(auth: mockLocalAuth);
  });

  group('BiometricService Tests', () {
    test('authenticate returns true when hardware verification succeeds', () async {
      when(() => mockLocalAuth.isDeviceSupported()).thenAnswer((_) async => true);
      when(() => mockLocalAuth.canCheckBiometrics).thenAnswer((_) async => true);
      when(() => mockLocalAuth.authenticate(
            localizedReason: any(named: 'localizedReason'),
            options: any(named: 'options'),
          )).thenAnswer((_) async => true);

      final result = await biometricService.authenticate(localizedReason: 'Test Unlock');

      expect(result, isTrue);
    });

    test('authenticate returns false when user cancels prompt', () async {
      when(() => mockLocalAuth.isDeviceSupported()).thenAnswer((_) async => true);
      when(() => mockLocalAuth.canCheckBiometrics).thenAnswer((_) async => true);
      when(() => mockLocalAuth.authenticate(
            localizedReason: any(named: 'localizedReason'),
            options: any(named: 'options'),
          )).thenThrow(PlatformException(code: 'UserCancel', message: 'User cancelled authentication.'));

      final result = await biometricService.authenticate(localizedReason: 'Test Unlock');

      expect(result, isFalse);
    });

    test('authenticate returns false when device does not support biometrics', () async {
      when(() => mockLocalAuth.isDeviceSupported()).thenAnswer((_) async => false);

      final result = await biometricService.authenticate(localizedReason: 'Test Unlock');

      expect(result, isFalse);
    });

    test('authenticate handles general platform exceptions gracefully without throwing', () async {
      when(() => mockLocalAuth.isDeviceSupported()).thenAnswer((_) async => true);
      when(() => mockLocalAuth.canCheckBiometrics).thenAnswer((_) async => true);
      when(() => mockLocalAuth.authenticate(
            localizedReason: any(named: 'localizedReason'),
            options: any(named: 'options'),
          )).thenThrow(PlatformException(code: 'LockedOut', message: 'Too many attempts.'));

      final result = await biometricService.authenticate(localizedReason: 'Test Unlock');

      expect(result, isFalse);
    });
  });
}
