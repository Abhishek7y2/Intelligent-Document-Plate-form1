import 'dart:async';
import 'package:dio/dio.dart';

import '../config/api_endpoints.dart';
import '../storage/secure_storage_service.dart';

typedef SessionExpiredCallback = void Function();

class AuthInterceptor extends QueuedInterceptor {
  final SecureStorageService _storage;
  final Dio _refreshDio;
  final SessionExpiredCallback? onSessionExpired;

  // Single-flight refresh coordination
  Completer<bool>? _refreshCompleter;

  AuthInterceptor({
    required SecureStorageService storage,
    required Dio refreshDio,
    this.onSessionExpired,
  })  : _storage = storage,
        _refreshDio = refreshDio;

  static const List<String> _publicEndpoints = [
    ApiEndpoints.login,
    ApiEndpoints.refresh,
    ApiEndpoints.requestOtp,
    ApiEndpoints.verifyOtp,
    ApiEndpoints.acceptInvite,
    ApiEndpoints.healthLive,
    ApiEndpoints.healthReady,
  ];

  bool _isPublicEndpoint(String path) {
    return _publicEndpoints.any((endpoint) => path.contains(endpoint));
  }

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // If request already has authorization or is a public unauthenticated endpoint, proceed
    if (!options.headers.containsKey('Authorization') && !_isPublicEndpoint(options.path)) {
      final token = await _storage.getAccessToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final statusCode = response?.statusCode;
    final requestPath = err.requestOptions.path;

    // Only handle 401 Unauthorized errors
    if (statusCode != 401) {
      handler.next(err);
      return;
    }

    // Do NOT attempt token refresh on login, refresh, or OTP endpoints to prevent loops
    if (requestPath.contains(ApiEndpoints.refresh) ||
        requestPath.contains(ApiEndpoints.login) ||
        requestPath.contains(ApiEndpoints.verifyOtp)) {
      if (requestPath.contains(ApiEndpoints.refresh)) {
        await _storage.clearAll();
        onSessionExpired?.call();
      }
      handler.next(err);
      return;
    }

    // Fast path: if another request already refreshed the token while this request was in flight,
    // retry immediately with the updated token without triggering another refresh.
    final currentToken = await _storage.getAccessToken();
    final requestAuthHeader = err.requestOptions.headers['Authorization'] as String?;
    final requestToken = requestAuthHeader != null && requestAuthHeader.startsWith('Bearer ')
        ? requestAuthHeader.substring(7)
        : null;

    if (currentToken != null &&
        currentToken.isNotEmpty &&
        requestToken != null &&
        requestToken != currentToken) {
      try {
        final requestOptions = err.requestOptions;
        requestOptions.headers['Authorization'] = 'Bearer $currentToken';
        final response = await _refreshDio.fetch(requestOptions);
        handler.resolve(response);
        return;
      } on DioException catch (retryErr) {
        handler.reject(retryErr);
        return;
      } catch (_) {
        handler.reject(err);
        return;
      }
    }

    // Synchronize concurrent refresh calls
    final bool refreshSuccess;
    if (_refreshCompleter != null && !_refreshCompleter!.isCompleted) {
      // Refresh already in progress; wait for in-flight single flight
      refreshSuccess = await _refreshCompleter!.future;
    } else {
      _refreshCompleter = Completer<bool>();
      final success = await _performTokenRefresh();
      _refreshCompleter!.complete(success);
      refreshSuccess = success;
      // Allow future refresh calls after completion
      _refreshCompleter = null;
    }

    if (refreshSuccess) {
      // Retry the failed request with the new access token
      try {
        final newToken = await _storage.getAccessToken();
        final requestOptions = err.requestOptions;
        requestOptions.headers['Authorization'] = 'Bearer $newToken';

        final response = await _refreshDio.fetch(requestOptions);
        handler.resolve(response);
        return;
      } on DioException catch (retryErr) {
        handler.reject(retryErr);
        return;
      } catch (_) {
        handler.reject(err);
        return;
      }
    } else {
      // Refresh failed; clear credentials and reject request
      await _storage.clearAll();
      onSessionExpired?.call();
      handler.reject(err);
    }
  }

  Future<bool> _performTokenRefresh() async {
    try {
      final currentRefreshToken = await _storage.getRefreshToken();
      if (currentRefreshToken == null || currentRefreshToken.isEmpty) {
        return false;
      }

      final response = await _refreshDio.post(
        ApiEndpoints.refresh,
        data: {'refreshToken': currentRefreshToken},
        options: Options(
          headers: {
            'Content-Type': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final newAccessToken = data['token'] as String?;
        final newRefreshToken = data['refreshToken'] as String?;

        if (newAccessToken != null && newAccessToken.isNotEmpty) {
          await _storage.setAccessToken(newAccessToken);
          if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
            await _storage.setRefreshToken(newRefreshToken);
          }
          return true;
        }
      }
      return false;
    } catch (_) {
      // Catches network errors or 401/403 refresh rejection without throwing
      return false;
    }
  }
}
