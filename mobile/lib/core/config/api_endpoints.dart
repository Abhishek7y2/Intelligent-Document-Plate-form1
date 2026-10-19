class ApiEndpoints {
  const ApiEndpoints._();

  // Health
  static const String healthLive = '/health/live';
  static const String healthReady = '/health/ready';

  // Authentication & Sessions
  static const String login = '/auth/login';
  static const String requestOtp = '/auth/request-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String acceptInvite = '/auth/accept-invite';
  static const String changePassword = '/auth/change-password';
  static const String sessions = '/auth/sessions';
  static String sessionById(String id) => '/auth/sessions/$id';

  // MFA
  static const String mfaEnroll = '/auth/mfa/enroll';
  static const String mfaVerifyEnrollment = '/auth/mfa/verify-enrollment';
  static const String mfaDisable = '/auth/mfa/disable';

  // Profile & User
  static const String userProfile = '/users/profile';
  static const String userAvatar = '/users/profile/avatar';
  static String userAvatarBinary(String filename) => '/users/profile/avatar/$filename';

  // Document Ingestion & Catalog (Target verified route /documents/upload, fixing DEF-001)
  static const String documentUpload = '/documents/upload';
  static const String documents = '/documents';
  static String documentById(String id) => '/documents/$id';
  static String documentVersions(String id) => '/documents/$id/versions';
  static String documentRetry(String id) => '/documents/$id/retry';
  static String documentPageImage(String id, int pageNo) => '/documents/$id/pages/$pageNo/image';

  // Review Workbench
  static const String reviewQueue = '/review/queue';
  static String reviewWorkbench(String id) => '/review/workbench/$id';
  static String reviewField(String id, String key) => '/review/$id/fields/$key';
  static String reviewDecision(String id) => '/review/$id/decision';

  // Approvals
  static const String approvalsQueue = '/approvals/queue';
  static String approvalDecision(String id) => '/approvals/$id/decision';

  // Search & Q&A
  static const String search = '/search';
  static const String qaAsk = '/qa/ask';
  static const String qaVerifyCitation = '/qa/verify-citation';

  // Comparison
  static const String compare = '/compare';
  static String compareById(String id) => '/compare/$id';

  // Tasks & Reports
  static const String tasks = '/tasks';
  static String taskById(String id) => '/tasks/$id';
  static const String reportsKpis = '/reports/kpis';
  static const String reportsOperational = '/reports/operational';
  static const String reportsGovernance = '/reports/governance';

  // Administration
  static const String adminTelemetry = '/admin/telemetry';
  static const String adminUsers = '/admin/users';
  static const String adminDocumentTypes = '/admin/document-types';
  static const String adminRetention = '/admin/retention';
  static const String adminLegalHold = '/admin/retention/holds';
  static const String adminOperationsQueue = '/admin/operations/queue';
  static String adminTrace(String correlationId) => '/admin/trace/$correlationId';
}
