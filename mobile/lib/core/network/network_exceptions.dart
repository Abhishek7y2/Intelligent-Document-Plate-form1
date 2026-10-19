import 'package:dio/dio.dart';

class ProblemDetails {
  final String? type;
  final String title;
  final int? status;
  final String? detail;
  final String? instance;
  final List<ValidationErrorDetail>? errors;
  final String? correlationId;

  const ProblemDetails({
    this.type,
    required this.title,
    this.status,
    this.detail,
    this.instance,
    this.errors,
    this.correlationId,
  });

  factory ProblemDetails.fromJson(Map<String, dynamic> json, {String? correlationId}) {
    List<ValidationErrorDetail>? validationErrors;
    if (json['errors'] is List) {
      validationErrors = (json['errors'] as List)
          .whereType<Map<String, dynamic>>()
          .map((e) => ValidationErrorDetail.fromJson(e))
          .toList();
    }

    return ProblemDetails(
      type: json['type'] as String?,
      title: (json['title'] ?? json['message'] ?? 'An unexpected error occurred') as String,
      status: json['status'] as int?,
      detail: json['detail'] as String?,
      instance: json['instance'] as String?,
      errors: validationErrors,
      correlationId: correlationId,
    );
  }
}

class ValidationErrorDetail {
  final String field;
  final String message;

  const ValidationErrorDetail({required this.field, required this.message});

  factory ValidationErrorDetail.fromJson(Map<String, dynamic> json) {
    return ValidationErrorDetail(
      field: (json['field'] ?? '') as String,
      message: (json['message'] ?? '') as String,
    );
  }
}

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final ProblemDetails? problemDetails;
  final String? correlationId;

  const ApiException({
    required this.message,
    this.statusCode,
    this.problemDetails,
    this.correlationId,
  });

  @override
  String toString() => 'ApiException: $message (status: $statusCode, correlationId: $correlationId)';

  factory ApiException.fromDioException(DioException dioError) {
    final response = dioError.response;
    final correlationId = response?.headers.value('x-correlation-id') ??
        dioError.requestOptions.headers['X-Correlation-Id'] as String?;

    if (response != null && response.data is Map<String, dynamic>) {
      final problem = ProblemDetails.fromJson(
        response.data as Map<String, dynamic>,
        correlationId: correlationId,
      );

      switch (response.statusCode) {
        case 400:
          return ValidationApiException(
            message: problem.title,
            statusCode: 400,
            problemDetails: problem,
            correlationId: correlationId,
            validationErrors: problem.errors ?? const [],
          );
        case 401:
          return UnauthorizedApiException(
            message: problem.title,
            statusCode: 401,
            problemDetails: problem,
            correlationId: correlationId,
          );
        case 403:
          return ForbiddenApiException(
            message: problem.title,
            statusCode: 403,
            problemDetails: problem,
            correlationId: correlationId,
          );
        case 404:
          return NotFoundApiException(
            message: problem.title,
            statusCode: 404,
            problemDetails: problem,
            correlationId: correlationId,
          );
        case 409:
          return ConflictApiException(
            message: problem.title,
            statusCode: 409,
            problemDetails: problem,
            correlationId: correlationId,
          );
        case 429:
          return RateLimitApiException(
            message: problem.title,
            statusCode: 429,
            problemDetails: problem,
            correlationId: correlationId,
          );
        default:
          if ((response.statusCode ?? 0) >= 500) {
            return ServerApiException(
              message: problem.title,
              statusCode: response.statusCode,
              problemDetails: problem,
              correlationId: correlationId,
            );
          }
          return ApiException(
            message: problem.title,
            statusCode: response.statusCode,
            problemDetails: problem,
            correlationId: correlationId,
          );
      }
    }

    if (dioError.type == DioExceptionType.connectionTimeout ||
        dioError.type == DioExceptionType.sendTimeout ||
        dioError.type == DioExceptionType.receiveTimeout) {
      return ApiException(
        message: 'Network connection timeout. Please check your network and try again.',
        correlationId: correlationId,
      );
    }

    if (dioError.type == DioExceptionType.connectionError) {
      return ApiException(
        message: 'Unable to connect to DocuNexa server. Verify network or host configuration.',
        correlationId: correlationId,
      );
    }

    return ApiException(
      message: dioError.message ?? 'An unexpected network error occurred.',
      correlationId: correlationId,
    );
  }
}

class UnauthorizedApiException extends ApiException {
  const UnauthorizedApiException({
    required super.message,
    super.statusCode = 401,
    super.problemDetails,
    super.correlationId,
  });
}

class ForbiddenApiException extends ApiException {
  const ForbiddenApiException({
    required super.message,
    super.statusCode = 403,
    super.problemDetails,
    super.correlationId,
  });
}

class ValidationApiException extends ApiException {
  final List<ValidationErrorDetail> validationErrors;

  const ValidationApiException({
    required super.message,
    super.statusCode = 400,
    super.problemDetails,
    super.correlationId,
    required this.validationErrors,
  });
}

class NotFoundApiException extends ApiException {
  const NotFoundApiException({
    required super.message,
    super.statusCode = 404,
    super.problemDetails,
    super.correlationId,
  });
}

class ConflictApiException extends ApiException {
  const ConflictApiException({
    required super.message,
    super.statusCode = 409,
    super.problemDetails,
    super.correlationId,
  });
}

class RateLimitApiException extends ApiException {
  const RateLimitApiException({
    required super.message,
    super.statusCode = 429,
    super.problemDetails,
    super.correlationId,
  });
}

class ServerApiException extends ApiException {
  const ServerApiException({
    required super.message,
    super.statusCode = 500,
    super.problemDetails,
    super.correlationId,
  });
}

class UnauthorizedException implements Exception {
  final String message;
  final int? statusCode;
  const UnauthorizedException([String? msg, {String? message, this.statusCode = 401}])
      : message = message ?? msg ?? 'Unauthorized';
  @override
  String toString() => message;
}

class ForbiddenException implements Exception {
  final String message;
  final int? statusCode;
  const ForbiddenException([String? msg, {String? message, this.statusCode = 403}])
      : message = message ?? msg ?? 'Forbidden';
  @override
  String toString() => message;
}

class NotFoundException implements Exception {
  final String message;
  final int? statusCode;
  const NotFoundException([String? msg, {String? message, this.statusCode = 404}])
      : message = message ?? msg ?? 'Not Found';
  @override
  String toString() => message;
}

class BadRequestException implements Exception {
  final String message;
  final int? statusCode;
  const BadRequestException([String? msg, {String? message, this.statusCode = 400}])
      : message = message ?? msg ?? 'Bad Request';
  @override
  String toString() => message;
}

class ServerException implements Exception {
  final String message;
  final int? statusCode;
  const ServerException([String? msg, {String? message, this.statusCode = 500}])
      : message = message ?? msg ?? 'Server Error';
  @override
  String toString() => message;
}

class NetworkException implements Exception {
  final String message;
  const NetworkException([String? msg, {String? message}])
      : message = message ?? msg ?? 'Network error';
  @override
  String toString() => message;
}

