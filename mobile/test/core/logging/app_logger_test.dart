import 'package:flutter_test/flutter_test.dart';
import 'package:docunexa_mobile/core/logging/app_logger.dart';

void main() {
  group('AppLogger Redaction Hardening Tests', () {
    test('redacts JWT bearer tokens completely from log strings', () {
      const logMessage = 'Sending request with header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak_signature';
      final redacted = AppLogger.redact(logMessage);

      expect(redacted, isNot(contains('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')));
      expect(redacted, contains('Bearer [REDACTED_JWT]'));
    });

    test('redacts plain-text passwords in JSON payloads', () {
      const logMessage = 'Payload: {"email": "admin@docunexa.com", "password": "SuperSecretPassword123!"}';
      final redacted = AppLogger.redact(logMessage);

      expect(redacted, isNot(contains('SuperSecretPassword123!')));
      expect(redacted, contains('"password": "[REDACTED_PASSWORD]"'));
    });

    test('redacts OTP and testOtp numeric codes', () {
      const logMessage = 'Verification response: {"code": "742918", "testOtp": "123456"}';
      final redacted = AppLogger.redact(logMessage);

      expect(redacted, isNot(contains('742918')));
      expect(redacted, isNot(contains('123456')));
      expect(redacted, contains('"code": "[REDACTED_OTP]"'));
      expect(redacted, contains('"testOtp": "[REDACTED_OTP]"'));
    });

    test('redacts refresh tokens in payloads', () {
      const logMessage = 'Token refresh: {"refreshToken": "d8f3b20c-5899-4d6b-93f5-67eb1c28c11e"}';
      final redacted = AppLogger.redact(logMessage);

      expect(redacted, isNot(contains('d8f3b20c-5899-4d6b-93f5-67eb1c28c11e')));
      expect(redacted, contains('"refreshToken": "[REDACTED_TOKEN]"'));
    });

    test('redacts email addresses preserving only first 2 prefix characters for debugging', () {
      const logMessage = 'User john.doe@example.com logged in';
      final redacted = AppLogger.redact(logMessage);

      expect(redacted, isNot(contains('john.doe@example.com')));
      expect(redacted, contains('jo***@example.com'));
    });
  });
}
