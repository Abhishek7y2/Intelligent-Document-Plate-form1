import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class SecureStorageService {
  Future<String?> getAccessToken();
  Future<void> setAccessToken(String token);
  Future<String?> getRefreshToken();
  Future<void> setRefreshToken(String token);
  Future<String?> getUserData();
  Future<void> setUserData(String jsonString);
  Future<bool> isBiometricEnabled();
  Future<void> setBiometricEnabled(bool enabled);
  Future<void> clearTokens();
  Future<void> clearAll();
}

class SecureStorageServiceImpl implements SecureStorageService {
  final FlutterSecureStorage _storage;

  static const String _keyAccessToken = 'auth_access_token';
  static const String _keyRefreshToken = 'auth_refresh_token';
  static const String _keyUserData = 'auth_user_data';
  static const String _keyBiometricEnabled = 'auth_biometric_enabled';

  SecureStorageServiceImpl(this._storage);

  @override
  Future<String?> getAccessToken() async {
    return _storage.read(key: _keyAccessToken);
  }

  @override
  Future<void> setAccessToken(String token) async {
    await _storage.write(key: _keyAccessToken, value: token);
  }

  @override
  Future<String?> getRefreshToken() async {
    return _storage.read(key: _keyRefreshToken);
  }

  @override
  Future<void> setRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  @override
  Future<String?> getUserData() async {
    return _storage.read(key: _keyUserData);
  }

  @override
  Future<void> setUserData(String jsonString) async {
    await _storage.write(key: _keyUserData, value: jsonString);
  }

  @override
  Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: _keyBiometricEnabled);
    return value == 'true';
  }

  @override
  Future<void> setBiometricEnabled(bool enabled) async {
    await _storage.write(key: _keyBiometricEnabled, value: enabled.toString());
  }

  @override
  Future<void> clearTokens() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
  }

  @override
  Future<void> clearAll() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
    await _storage.delete(key: _keyUserData);
    // Note: We preserve biometric preference or delete per enterprise security policy.
    // Deleting credentials invalidates any biometric unlock session.
  }
}
