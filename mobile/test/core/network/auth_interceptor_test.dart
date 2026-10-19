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
  late bool sessionExpiredCalled;
  late AuthInterceptor interceptor;

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

  group('AuthInterceptor Request Header Tests', () {
    test('attaches Authorization Bearer token to protected endpoints', () async {
      when(() => mockStorage.getAccessToken())
          .thenAnswer((_) async => 'valid_access_token');

      final options = RequestOptions(path: '/api/v1/documents');
      final handler = MockRequestInterceptorHandler();
      when(() => handler.next(options)).thenReturn(null);

      await interceptor.onRequest(options, handler);

      expect(options.headers['Authorization'], 'Bearer valid_access_token');
      verify(() => handler.next(options)).called(1);
    });

    test('does NOT attach Authorization Bearer token to public login endpoint', () async {
      final options = RequestOptions(path: ApiEndpoints.login);
      final handler = MockRequestInterceptorHandler();
      when(() => handler.next(options)).thenReturn(null);

      await interceptor.onRequest(options, handler);

      expect(options.headers.containsKey('Authorization'), isFalse);
      verify(() => handler.next(options)).called(1);
      verifyNever(() => mockStorage.getAccessToken());
    });

    test('does NOT attach Authorization Bearer token to public OTP endpoint', () async {
      final options = RequestOptions(path: ApiEndpoints.requestOtp);
      final handler = MockRequestInterceptorHandler();
      when(() => handler.next(options)).thenReturn(null);

      await interceptor.onRequest(options, handler);

      expect(options.headers.containsKey('Authorization'), isFalse);
      verify(() => handler.next(options)).called(1);
    });
  });

  group('AuthInterceptor Refresh & Concurrency Tests', () {
    test('401 on refresh endpoint does NOT trigger refresh loop and purges credentials', () async {
      when(() => mockStorage.clearAll()).thenAnswer((_) async {});

      final requestOptions = RequestOptions(path: ApiEndpoints.refresh);
      final dioException = DioException(
        requestOptions: requestOptions,
        response: Response(
          requestOptions: requestOptions,
          statusCode: 401,
        ),
      );
      final handler = MockErrorInterceptorHandler();
      when(() => handler.next(dioException)).thenReturn(null);

      await interceptor.onError(dioException, handler);

      expect(sessionExpiredCalled, isTrue);
      verify(() => mockStorage.clearAll()).called(1);
      verify(() => handler.next(dioException)).called(1);
      verifyNever(() => mockRefreshDio.post(any(), data: any(named: 'data')));
    });

    test('concurrent 401 requests trigger only ONE refresh request (single-flight)', () async {
      // Simulate refresh token stored
      when(() => mockStorage.getRefreshToken())
          .thenAnswer((_) async => 'valid_refresh_token');
      when(() => mockStorage.setAccessToken('new_access_token'))
          .thenAnswer((_) async {});
      when(() => mockStorage.setRefreshToken('new_refresh_token'))
          .thenAnswer((_) async {});
      when(() => mockStorage.getAccessToken())
          .thenAnswer((_) async => 'new_access_token');

      // Refresh endpoint returns 200 with new tokens
      when(() => mockRefreshDio.post(
            ApiEndpoints.refresh,
            data: {'refreshToken': 'valid_refresh_token'},
            options: any(named: 'options'),
          )).thenAnswer((_) async {
        // Add slight delay to test concurrency window
        await Future.delayed(const Duration(milliseconds: 20));
        return Response(
          requestOptions: RequestOptions(path: ApiEndpoints.refresh),
          statusCode: 200,
          data: {
            'token': 'new_access_token',
            'refreshToken': 'new_refresh_token',
            'expiresIn': 28800,
          },
        );
      });

      // Retried requests succeed with 200
      when(() => mockRefreshDio.fetch(any())).thenAnswer((inv) async {
        final opts = inv.positionalArguments[0] as RequestOptions;
        return Response(
          requestOptions: opts,
          statusCode: 200,
          data: {'success': true},
        );
      });

      final options1 = RequestOptions(path: '/api/v1/documents/1');
      final err1 = DioException(
        requestOptions: options1,
        response: Response(requestOptions: options1, statusCode: 401),
      );
      final handler1 = MockErrorInterceptorHandler();
      when(() => handler1.resolve(any())).thenReturn(null);

      final options2 = RequestOptions(path: '/api/v1/documents/2');
      final err2 = DioException(
        requestOptions: options2,
        response: Response(requestOptions: options2, statusCode: 401),
      );
      final handler2 = MockErrorInterceptorHandler();
      when(() => handler2.resolve(any())).thenReturn(null);

      // Fire both 401 errors concurrently
      await Future.wait([
        interceptor.onError(err1, handler1),
        interceptor.onError(err2, handler2),
      ]);

      // Exactly ONE refresh call made despite 2 concurrent 401s!
      verify(() => mockRefreshDio.post(
            ApiEndpoints.refresh,
            data: {'refreshToken': 'valid_refresh_token'},
            options: any(named: 'options'),
          )).called(1);

      // Both requests were resolved after token renewal
      verify(() => handler1.resolve(any())).called(1);
      verify(() => handler2.resolve(any())).called(1);
      expect(options1.headers['Authorization'], 'Bearer new_access_token');
      expect(options2.headers['Authorization'], 'Bearer new_access_token');
    });

    test('failed refresh call purges credentials, notifies session expiry, and rejects request', () async {
      when(() => mockStorage.getRefreshToken())
          .thenAnswer((_) async => 'expired_refresh_token');
      when(() => mockStorage.clearAll()).thenAnswer((_) async {});

      // Refresh call returns 401
      when(() => mockRefreshDio.post(
            ApiEndpoints.refresh,
            data: {'refreshToken': 'expired_refresh_token'},
            options: any(named: 'options'),
          )).thenThrow(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.refresh),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.refresh),
          statusCode: 401,
        ),
      ));

      final options = RequestOptions(path: '/api/v1/documents');
      final err = DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 401),
      );
      final handler = MockErrorInterceptorHandler();
      when(() => handler.reject(err)).thenReturn(null);

      await interceptor.onError(err, handler);

      expect(sessionExpiredCalled, isTrue);
      verify(() => mockStorage.clearAll()).called(1);
      verify(() => handler.reject(err)).called(1);
    });
  });
}
