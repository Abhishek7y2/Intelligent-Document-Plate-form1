import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/storage/secure_storage_service.dart';

class MockFlutterSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  late MockFlutterSecureStorage mockStorage;
  late SecureStorageServiceImpl storageService;

  setUp(() {
    mockStorage = MockFlutterSecureStorage();
    storageService = SecureStorageServiceImpl(mockStorage);
  });

  group('SecureStorageService Tests', () {
    test('getAccessToken returns stored token', () async {
      when(() => mockStorage.read(key: 'auth_access_token'))
          .thenAnswer((_) async => 'mock_access_jwt');

      final token = await storageService.getAccessToken();

      expect(token, 'mock_access_jwt');
      verify(() => mockStorage.read(key: 'auth_access_token')).called(1);
    });

    test('setAccessToken stores token securely', () async {
      when(() => mockStorage.write(key: 'auth_access_token', value: 'new_token'))
          .thenAnswer((_) async {});

      await storageService.setAccessToken('new_token');

      verify(() => mockStorage.write(key: 'auth_access_token', value: 'new_token')).called(1);
    });

    test('getRefreshToken returns stored refresh token', () async {
      when(() => mockStorage.read(key: 'auth_refresh_token'))
          .thenAnswer((_) async => 'mock_refresh_token');

      final token = await storageService.getRefreshToken();

      expect(token, 'mock_refresh_token');
      verify(() => mockStorage.read(key: 'auth_refresh_token')).called(1);
    });

    test('setRefreshToken stores refresh token securely', () async {
      when(() => mockStorage.write(key: 'auth_refresh_token', value: 'new_refresh'))
          .thenAnswer((_) async {});

      await storageService.setRefreshToken('new_refresh');

      verify(() => mockStorage.write(key: 'auth_refresh_token', value: 'new_refresh')).called(1);
    });

    test('isBiometricEnabled returns true when flag is "true"', () async {
      when(() => mockStorage.read(key: 'auth_biometric_enabled'))
          .thenAnswer((_) async => 'true');

      final enabled = await storageService.isBiometricEnabled();

      expect(enabled, isTrue);
    });

    test('isBiometricEnabled returns false when flag is not set or false', () async {
      when(() => mockStorage.read(key: 'auth_biometric_enabled'))
          .thenAnswer((_) async => null);

      final enabled = await storageService.isBiometricEnabled();

      expect(enabled, isFalse);
    });

    test('clearTokens removes access and refresh tokens', () async {
      when(() => mockStorage.delete(key: any(named: 'key')))
          .thenAnswer((_) async {});

      await storageService.clearTokens();

      verify(() => mockStorage.delete(key: 'auth_access_token')).called(1);
      verify(() => mockStorage.delete(key: 'auth_refresh_token')).called(1);
    });

    test('clearAll removes tokens and user data', () async {
      when(() => mockStorage.delete(key: any(named: 'key')))
          .thenAnswer((_) async {});

      await storageService.clearAll();

      verify(() => mockStorage.delete(key: 'auth_access_token')).called(1);
      verify(() => mockStorage.delete(key: 'auth_refresh_token')).called(1);
      verify(() => mockStorage.delete(key: 'auth_user_data')).called(1);
    });
  });
}
