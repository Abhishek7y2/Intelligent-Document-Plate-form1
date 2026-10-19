import 'dart:math';
import 'package:dio/dio.dart';

class CorrelationInterceptor extends Interceptor {
  static final Random _secureRandom = Random.secure();

  static String generateCorrelationId() {
    final values = List<int>.generate(16, (i) => _secureRandom.nextInt(256));
    // Set version 4 (bits 12-15 = 0100)
    values[6] = (values[6] & 0x0f) | 0x40;
    // Set variant (bits 6-7 = 10)
    values[8] = (values[8] & 0x3f) | 0x80;

    final hex = values.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}';
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!options.headers.containsKey('X-Correlation-Id')) {
      options.headers['X-Correlation-Id'] = generateCorrelationId();
    }
    super.onRequest(options, handler);
  }
}
