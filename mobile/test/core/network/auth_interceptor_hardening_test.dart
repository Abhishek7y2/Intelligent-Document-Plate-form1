import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/config/api_endpoints.dart';
import 'package:docunexa_mobile/core/network/auth_interceptor.dart';
import 'package:docunexa_mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}
class MockDio extends Mock implements Dio {}
class MockRequestInterceptorHandler extends Mock implements RequestInterceptorHandler {}
class MockErrorInterceptorHandler extends Mock implements ErrorInterceptorHandler {}

void main() {
  late MockSecureStorageService mockStorage;
  late MockDio mockRefreshDio;
  late AuthInterceptor interceptor;
  bool sessionExpiredCalled = false;

  setUp(() {
    mockStorage = MockSecureStorageService();
    mockRefreshDio = MockDio();
    sessionExpiredCalled = false;

    interceptor = AuthInterceptor(
      storage: mockStorage,
      refreshDio: mockRefreshDio,
      onSessionExpired: () {
        sessionExpiredCalled = true;
      },
    );
  });

  group('AuthInterceptor Hardening Tests', () {
    test('non-401 error is passed directly to handler without refresh', () async {
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/api/v1/documents'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/documents'),
          statusCode: 500,
        ),
      );
      final handler = MockErrorInterceptorHandler();

      await interceptor.onError(dioError, handler);

      verify(() => handler.next(dioError)).called(1);
      verifyNever(() => mockStorage.getRefreshToken());
    });

    test('401 on refresh endpoint immediately clears storage and notifies session expiration', () async {
      when(() => mockStorage.clearAll()).thenAnswer((_) async {});

      final dioError = DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.refresh),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.refresh),
          statusCode: 401,
        ),
      );
      final handler = MockErrorInterceptorHandler();

      await interceptor.onError(dioError, handler);

      verify(() => mockStorage.clearAll()).called(1);
      expect(sessionExpiredCalled, isTrue);
      verify(() => handler.next(dioError)).called(1);
    });

    test('fast-path retry succeeds without calling refresh if storage already holds updated token', () async {
      // The request had OldToken
      final options = RequestOptions(
        path: '/api/v1/documents',
        headers: {'Authorization': 'Bearer old_token_123'},
      );
      final dioError = DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 401),
      );
      final handler = MockErrorInterceptorHandler();

      // Storage already contains NewToken refreshed by a concurrent request
      when(() => mockStorage.getAccessToken())
          .thenAnswer((_) async => 'new_token_456');

      final successResponse = Response(
        requestOptions: options,
        statusCode: 200,
        data: {'success': true},
      );

      when(() => mockRefreshDio.fetch(any()))
          .thenAnswer((_) async => successResponse);

      await interceptor.onError(dioError, handler);

      // Verify fetch was called with the new token directly
      verify(() => mockRefreshDio.fetch(any())).called(1);
      verify(() => handler.resolve(successResponse)).called(1);
      // Ensure refresh endpoint was NOT called
      verifyNever(() => mockRefreshDio.post(any(), data: any(named: 'data')));
    });

    test('performs token refresh and retries original request when token matches stored token', () async {
      final options = RequestOptions(
        path: '/api/v1/documents',
        headers: {'Authorization': 'Bearer expired_token_111'},
      );
      final dioError = DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 401),
      );
      final handler = MockErrorInterceptorHandler();

      when(() => mockStorage.getAccessToken())
          .thenAnswer((_) async => 'expired_token_111');
      when(() => mockStorage.getRefreshToken())
          .thenAnswer((_) async => 'valid_refresh_token_222');
      when(() => mockStorage.setAccessToken('fresh_access_token_333'))
          .thenAnswer((_) async {});
      when(() => mockStorage.setRefreshToken(any()))
          .thenAnswer((_) async {});

      final refreshResponse = Response(
        requestOptions: RequestOptions(path: ApiEndpoints.refresh),
        statusCode: 200,
        data: {
          'token': 'fresh_access_token_333',
          'refreshToken': 'fresh_refresh_token_444',
        },
      );

      when(() => mockRefreshDio.post(
            ApiEndpoints.refresh,
            data: {'refreshToken': 'valid_refresh_token_222'},
            options: any(named: 'options'),
          )).thenAnswer((_) async => refreshResponse);

      final retryResponse = Response(
        requestOptions: options,
        statusCode: 200,
        data: {'items': []},
      );

      when(() => mockRefreshDio.fetch(any()))
          .thenAnswer((_) async => retryResponse);

      // Second call to getAccessToken after refresh returns the fresh token
      var callCount = 0;
      when(() => mockStorage.getAccessToken()).thenAnswer((_) async {
        callCount++;
        return callCount == 1 ? 'expired_token_111' : 'fresh_access_token_333';
      });

      await interceptor.onError(dioError, handler);

      verify(() => mockStorage.setAccessToken('fresh_access_token_333')).called(1);
      verify(() => handler.resolve(retryResponse)).called(1);
    });

    test('clears storage and triggers session expired when refresh fails', () async {
      final options = RequestOptions(
        path: '/api/v1/tasks',
        headers: {'Authorization': 'Bearer expired_token_111'},
      );
      final dioError = DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 401),
      );
      final handler = MockErrorInterceptorHandler();

      when(() => mockStorage.getAccessToken())
          .thenAnswer((_) async => 'expired_token_111');
      when(() => mockStorage.getRefreshToken())
          .thenAnswer((_) async => 'invalid_refresh_token');
      when(() => mockStorage.clearAll())
          .thenAnswer((_) async {});

      when(() => mockRefreshDio.post(
            ApiEndpoints.refresh,
            data: {'refreshToken': 'invalid_refresh_token'},
            options: any(named: 'options'),
          )).thenThrow(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.refresh),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.refresh),
          statusCode: 401,
        ),
      ));

      await interceptor.onError(dioError, handler);

      verify(() => mockStorage.clearAll()).called(1);
      expect(sessionExpiredCalled, isTrue);
      verify(() => handler.reject(dioError)).called(1);
    });
  });
}
