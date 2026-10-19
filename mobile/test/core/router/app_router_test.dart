import 'package:flutter_test/flutter_test.dart';
import 'package:docunexa_mobile/core/router/app_router.dart';

void main() {
  group('AppRouter Configuration Tests', () {
    test('Router initializes with correct configuration', () {
      final router = AppRouter.router;
      expect(router, isNotNull);
      expect(router.routeInformationProvider, isNotNull);
    });
  });
}
