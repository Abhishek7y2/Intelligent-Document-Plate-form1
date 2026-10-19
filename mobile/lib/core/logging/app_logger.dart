import 'dart:developer' as developer;

enum LogLevel {
  debug,
  info,
  warning,
  error,
}

class AppLogger {
  final bool enableDebugLogging;

  const AppLogger({this.enableDebugLogging = true});

  // Redaction patterns to protect secrets, tokens, OTPs, and passwords
  static final RegExp _jwtPattern = RegExp(r'Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*');
  static final RegExp _passwordPattern = RegExp(r'"password"\s*:\s*"[^"]*"', caseSensitive: false);
  static final RegExp _otpPattern = RegExp(r'"(code|otp|testOtp)"\s*:\s*"?[0-9]{4,8}"?', caseSensitive: false);
  static final RegExp _refreshTokenPattern = RegExp(r'"refreshToken"\s*:\s*"[^"]*"', caseSensitive: false);
  static final RegExp _emailPattern = RegExp(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b');

  static String redact(String message) {
    var sanitized = message;
    sanitized = sanitized.replaceAllMapped(_jwtPattern, (_) => 'Bearer [REDACTED_JWT]');
    sanitized = sanitized.replaceAllMapped(_passwordPattern, (_) => '"password": "[REDACTED_PASSWORD]"');
    sanitized = sanitized.replaceAllMapped(_otpPattern, (match) => '"${match.group(1)}": "[REDACTED_OTP]"');
    sanitized = sanitized.replaceAllMapped(_refreshTokenPattern, (_) => '"refreshToken": "[REDACTED_TOKEN]"');
    sanitized = sanitized.replaceAllMapped(_emailPattern, (match) {
      final email = match.group(0)!;
      final parts = email.split('@');
      if (parts[0].length <= 2) return '***@${parts[1]}';
      return '${parts[0].substring(0, 2)}***@${parts[1]}';
    });
    return sanitized;
  }

  void debug(String message, {String tag = 'DocuNexa'}) {
    if (!enableDebugLogging) return;
    _log(LogLevel.debug, message, tag);
  }

  void info(String message, {String tag = 'DocuNexa'}) {
    _log(LogLevel.info, message, tag);
  }

  void warning(String message, {String tag = 'DocuNexa'}) {
    _log(LogLevel.warning, message, tag);
  }

  void error(String message, {Object? error, StackTrace? stackTrace, String tag = 'DocuNexa'}) {
    _log(LogLevel.error, message, tag, error: error, stackTrace: stackTrace);
  }

  void _log(LogLevel level, String message, String tag, {Object? error, StackTrace? stackTrace}) {
    final sanitizedMessage = redact(message);
    final prefix = '[${level.name.toUpperCase()}][$tag]';
    developer.log(
      '$prefix $sanitizedMessage',
      name: 'DocuNexa',
      error: error,
      stackTrace: stackTrace,
    );
  }
}
