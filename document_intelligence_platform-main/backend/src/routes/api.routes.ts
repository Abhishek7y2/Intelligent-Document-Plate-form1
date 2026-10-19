import { Router } from 'express';
import { getLiveness, getReadiness } from '../controllers/health.controller.js';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  requestOtpHandler,
  verifyOtpHandler,
  smtpStatusHandler,
  acceptInviteHandler,
  enrollMfaHandler,
  verifyMfaEnrollmentHandler,
  disableMfaHandler,
  getRolesHandler,
  changePasswordHandler,
  getSessionsHandler,
  revokeSessionHandler,
} from '../controllers/auth.controller.js';
import {
  getProfileHandler,
  updateProfileHandler,
  uploadAvatarHandler,
  avatarUploadMiddleware,
  getAvatarBinaryHandler,
} from '../controllers/profile.controller.js';
import {
  inviteUserHandler,
  listInvitationsHandler,
  revokeInvitationHandler,
  updateUserRoleHandler,
} from '../controllers/user.controller.js';
import { listDocumentsHandler, getDocumentPageImageHandler } from '../controllers/document.controller.js';
import {
  listTasksHandler,
  createTaskHandler,
  getTaskHandler,
  updateTaskHandler,
  addTaskCommentHandler,
  listTaskCommentsHandler,
} from '../controllers/task.controller.js';
import {
  listDocumentTypesHandler,
  getDocumentTypeHandler,
  createDocumentTypeHandler,
  updateDocumentTypeHandler,
  listTemplatesHandler,
  getTemplateHandler,
  createDraftTemplateHandler,
  publishTemplateHandler,
  validateTemplateHandler,
  listPoliciesHandler,
  getPolicyHandler,
  createDraftPolicyHandler,
  publishPolicyHandler,
  evaluatePolicyHandler,
} from '../controllers/schema.controller.js';
import { authenticateJwt, requirePermission, enforceTenantIsolation, shieldOperatorContent } from '../middleware/auth.middleware.js';
import {
  loginRateLimiter,
  authRateLimiter,
  acceptInviteRateLimiter,
  mfaRateLimiter,
  uploadRateLimiter,
  exportRateLimiter,
} from '../middleware/rate-limit.middleware.js';

import {
  uploadDocumentHandler,
  getDocumentDetailHandler,
  documentUploadMiddleware,
  retryDocumentHandler,
  listDocumentAttemptsHandler,
  replaceDocumentHandler,
  listDocumentVersionsHandler,
} from '../controllers/intake.controller.js';
import { processOcrHandler, getOcrResultHandler, getPageGeometryHandler } from '../controllers/ocr.controller.js';
import { classifyDocumentHandler, getClassificationHandler } from '../controllers/classification.controller.js';
import { extractDocumentHandler, getExtractionHandler } from '../controllers/extraction.controller.js';
import {
  getReviewQueueHandler,
  getReviewWorkbenchHandler,
  correctFieldHandler,
  submitReviewDecisionHandler,
  getReviewAuditLogsHandler,
} from '../controllers/review.controller.js';
import {
  getApprovalQueueHandler,
  getApprovalDetailsHandler,
  submitApprovalDecisionHandler,
} from '../controllers/approval.controller.js';
import {
  publishDocumentToErpHandler,
  getErpPublicationStatusHandler,
} from '../controllers/erp.controller.js';
import {
  searchHandler,
  indexDocumentHandler,
} from '../controllers/search.controller.js';
import {
  compareDocumentsHandler,
  getComparisonHandler,
} from '../controllers/compare.controller.js';
import {
  askQuestionHandler,
  verifyCitationHandler,
  listQaDocumentsHandler,
  submitFeedbackHandler,
} from '../controllers/qa.controller.js';
import fs from 'fs';
import path from 'path';
import {
  listNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
  getPreferencesHandler,
  updatePreferenceHandler,
  createStreamTicketHandler,
  notificationStreamHandler,
} from '../controllers/notification.controller.js';
import {
  getGovernanceReportHandler,
  getOperationalKpiSummaryHandler,
  getExtractionQualityHandler,
} from '../controllers/report.controller.js';
import {
  requestExportHandler,
  getExportJobHandler,
  listExportJobsHandler,
  downloadExportHandler,
  revokeExportHandler,
} from '../controllers/export.controller.js';
import {
  getTraceHandler,
  listExportMaskingRulesHandler,
  createExportMaskingRuleHandler,
  getExportMaskingRuleHandler,
  updateExportMaskingRuleHandler,
  deleteExportMaskingRuleHandler,
  listFailedJobsHandler,
  retryFailedJobHandler,
} from '../controllers/admin.controller.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  createSubscriptionHandler,
  listSubscriptionsHandler,
  deleteSubscriptionHandler,
  retryDeliveryHandler,
  getDeliveryHistoryHandler,
} from '../controllers/webhook.controller.js';
import {
  upsertMappingHandler,
  getMappingHandler,
  signOffMappingHandler,
  dispatchConnectorHandler,
} from '../controllers/connector.controller.js';
import {
  listRetentionPoliciesHandler,
  upsertRetentionPolicyHandler,
  listLegalHoldsHandler,
  placeLegalHoldHandler,
  releaseLegalHoldHandler,
  listDeletionCasesHandler,
  requestDeletionCaseHandler,
  approveDeletionCaseHandler,
  executePurgeHandler,
  getPurgeEvidenceHandler,
  listPurgeLedgerHandler,
} from '../controllers/retention.controller.js';
import {
  generateSummaryHandler,
  getSummaryHandler,
  correctSummaryHandler,
} from '../controllers/summary.controller.js';
import {
  listMailboxesHandler,
  createMailboxHandler,
  updateMailboxHandler,
} from '../controllers/mailbox.controller.js';
import {
  triggerAiEvaluationHandler,
  listAiEvaluationRunsHandler,
} from '../controllers/ai-quality.controller.js';

export const apiRouter = Router();

// 1. System Health Routes (Public)
apiRouter.get('/health', getLiveness);
apiRouter.get('/ready', getReadiness);

// 2. Identity & Session Routes
apiRouter.post('/auth/login', loginRateLimiter, loginHandler);
apiRouter.post('/auth/request-otp', loginRateLimiter, requestOtpHandler);
apiRouter.post('/auth/verify-otp', loginRateLimiter, verifyOtpHandler);
apiRouter.get('/auth/smtp-status', smtpStatusHandler);
apiRouter.post('/auth/refresh', authRateLimiter, refreshHandler);
apiRouter.post('/auth/logout', logoutHandler);
apiRouter.get('/auth/me', authenticateJwt, meHandler);
apiRouter.post('/auth/accept-invite', acceptInviteRateLimiter, acceptInviteHandler);
apiRouter.post('/auth/mfa/enroll', authenticateJwt, mfaRateLimiter, enrollMfaHandler);
apiRouter.post('/auth/mfa/verify-enrollment', authenticateJwt, mfaRateLimiter, verifyMfaEnrollmentHandler);
apiRouter.post('/auth/mfa/disable', authenticateJwt, mfaRateLimiter, disableMfaHandler);
apiRouter.post('/auth/change-password', authenticateJwt, enforceTenantIsolation, authRateLimiter, changePasswordHandler);
apiRouter.get('/auth/sessions', authenticateJwt, enforceTenantIsolation, getSessionsHandler);
apiRouter.delete('/auth/sessions/:id', authenticateJwt, enforceTenantIsolation, revokeSessionHandler);
apiRouter.get('/roles', authenticateJwt, getRolesHandler);

// 2.05 User Profile & Avatar Routes
apiRouter.get('/users/profile', authenticateJwt, enforceTenantIsolation, getProfileHandler);
apiRouter.patch('/users/profile', authenticateJwt, enforceTenantIsolation, updateProfileHandler);
apiRouter.post('/users/profile/avatar', authenticateJwt, enforceTenantIsolation, avatarUploadMiddleware, uploadAvatarHandler);
apiRouter.get('/users/profile/avatar/:filename', authenticateJwt, enforceTenantIsolation, getAvatarBinaryHandler);

// 2.1 User Invitation & Management Routes (Admin only)
apiRouter.post(
  '/users/invite',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  idempotencyMiddleware,
  inviteUserHandler
);

apiRouter.get(
  '/users/invitations',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  listInvitationsHandler
);

apiRouter.delete(
  '/users/invitations/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  revokeInvitationHandler
);

apiRouter.patch(
  '/users/:id/role',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  updateUserRoleHandler
);

// 2.2 Intake Mailboxes Administration Routes (Admin only)
apiRouter.get(
  '/admin/intake-mailboxes',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  listMailboxesHandler
);

apiRouter.post(
  '/admin/intake-mailboxes',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  createMailboxHandler
);

apiRouter.patch(
  '/admin/intake-mailboxes/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('USER_MANAGE'),
  updateMailboxHandler
);

// 2.3 Export Masking Rules & Admin Trace (Sprint 6 - FR-018, NFR-07)
apiRouter.get(
  '/admin/trace',
  authenticateJwt,
  enforceTenantIsolation,
  getTraceHandler
);

apiRouter.get(
  '/admin/export-masking-rules',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  exportRateLimiter,
  listExportMaskingRulesHandler
);

apiRouter.post(
  '/admin/export-masking-rules',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  createExportMaskingRuleHandler
);

apiRouter.get(
  '/admin/export-masking-rules/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  getExportMaskingRuleHandler
);

apiRouter.put(
  '/admin/export-masking-rules/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  updateExportMaskingRuleHandler
);

apiRouter.delete(
  '/admin/export-masking-rules/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  deleteExportMaskingRuleHandler
);

// 2.4 Operations DLQ & Monitoring Routes (Sprint 8 Part 0.3 / F.2)
apiRouter.get(
  '/admin/operations/dlq',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  listFailedJobsHandler
);

apiRouter.post(
  '/admin/operations/dlq/:id/retry',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  retryFailedJobHandler
);

// 2.5 AI Quality & Evaluation Routes (Sprint 8 Part E / AI-008)
apiRouter.post(
  '/admin/ai-quality/run',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  triggerAiEvaluationHandler
);

apiRouter.get(
  '/admin/ai-quality/runs',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  listAiEvaluationRunsHandler
);

// 3. Document Management & Ingestion Routes (Protected & Tenant-Isolated)
apiRouter.post(
  '/documents/upload',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_UPLOAD'),
  uploadRateLimiter,
  documentUploadMiddleware,
  idempotencyMiddleware,
  uploadDocumentHandler
);

apiRouter.get(
  '/documents',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  listDocumentsHandler
);

apiRouter.get(
  '/documents/:id',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getDocumentDetailHandler
);

apiRouter.get(
  '/documents/:id/pages/:pageNo/image',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getDocumentPageImageHandler
);

// Sprint 3: Manual Retry and Attempt History Endpoints
apiRouter.post(
  '/documents/:id/retry',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  idempotencyMiddleware,
  retryDocumentHandler
);

apiRouter.get(
  '/documents/:id/attempts',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  listDocumentAttemptsHandler
);

// Sprint 4: Document File Replacement and Version History Endpoints
apiRouter.post(
  '/documents/:id/replace',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_UPLOAD'),
  uploadRateLimiter,
  documentUploadMiddleware,
  idempotencyMiddleware,
  replaceDocumentHandler
);

apiRouter.get(
  '/documents/:id/versions',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  listDocumentVersionsHandler
);

// AI-007 Grounded Document Summaries Routes (Sprint 5)
apiRouter.post(
  '/documents/:id/summary',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  idempotencyMiddleware,
  generateSummaryHandler
);

apiRouter.get(
  '/documents/:id/summary',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getSummaryHandler
);

apiRouter.put(
  '/documents/:id/summary/:summaryId',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  correctSummaryHandler
);

// OCR & Geometry Extraction Routes (Sprint 5 - FR-003, FR-005, FR-006)
apiRouter.post(
  '/documents/:id/process-ocr',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  processOcrHandler
);

apiRouter.get(
  '/documents/:id/ocr',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getOcrResultHandler
);

apiRouter.get(
  '/documents/:id/pages/:pageNumber/geometry',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getPageGeometryHandler
);

// Classification & Field Extraction Routes (Sprint 6 - FR-004, FR-005, FR-006, FR-007, FR-008)
apiRouter.post(
  '/documents/:id/classify',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  classifyDocumentHandler
);

apiRouter.get(
  '/documents/:id/classification',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getClassificationHandler
);

apiRouter.post(
  '/documents/:id/extract',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  extractDocumentHandler
);

apiRouter.get(
  '/documents/:id/extraction',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getExtractionHandler
);

// Review Workbench & HITL Queue Routes (Sprint 7 - FR-008)
apiRouter.get(
  '/review/queue',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getReviewQueueHandler
);

apiRouter.get(
  '/review/:id',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getReviewWorkbenchHandler
);

apiRouter.post(
  '/review/:id/fields/:key',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_EDIT'),
  correctFieldHandler
);

apiRouter.post(
  '/review/:id/decision',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VERIFY'),
  submitReviewDecisionHandler
);

apiRouter.get(
  '/review/:id/audit',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getReviewAuditLogsHandler
);

// Approval Center & Governance Routes (Sprint 8 - FR-010, FR-011)
apiRouter.get(
  '/approvals/queue',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getApprovalQueueHandler
);

apiRouter.get(
  '/approvals/:id',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  getApprovalDetailsHandler
);

apiRouter.post(
  '/approvals/:id/decide',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_APPROVE'),
  submitApprovalDecisionHandler
);

// ERP Outbound Publishing Routes (Sprint 8 - FR-013)
apiRouter.post(
  '/erp/publish/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_APPROVE'),
  publishDocumentToErpHandler
);

apiRouter.get(
  '/erp/status/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getErpPublicationStatusHandler
);

// 4. Document Types Catalog (Sprint 3)
apiRouter.get(
  '/document-types',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_VIEW'),
  listDocumentTypesHandler
);

apiRouter.get(
  '/document-types/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_VIEW'),
  getDocumentTypeHandler
);

apiRouter.post(
  '/document-types',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_MANAGE'),
  createDocumentTypeHandler
);

apiRouter.put(
  '/document-types/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_MANAGE'),
  updateDocumentTypeHandler
);

// 5. Extraction Templates & Field Definitions (Sprint 3)
apiRouter.get(
  '/document-types/:typeId/templates',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_VIEW'),
  listTemplatesHandler
);

apiRouter.get(
  '/extraction-templates',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_VIEW'),
  listTemplatesHandler
);

apiRouter.get(
  '/document-types/:typeId/templates/:version',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_VIEW'),
  getTemplateHandler
);

apiRouter.post(
  '/document-types/:typeId/templates',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_MANAGE'),
  createDraftTemplateHandler
);

apiRouter.post(
  '/document-types/:typeId/templates/:version/publish',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_MANAGE'),
  publishTemplateHandler
);

apiRouter.post(
  '/document-types/:typeId/templates/validate',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('SCHEMA_VIEW'),
  validateTemplateHandler
);

// 6. Policy Configuration & Evaluation (Sprint 3)
apiRouter.get(
  '/policies',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_VIEW'),
  listPoliciesHandler
);

apiRouter.get(
  '/document-types/:typeId/policies',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_VIEW'),
  listPoliciesHandler
);

apiRouter.get(
  '/policies/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_VIEW'),
  getPolicyHandler
);

apiRouter.post(
  '/document-types/:typeId/policies',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_MANAGE'),
  createDraftPolicyHandler
);

apiRouter.post(
  '/policies/:id/publish',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_MANAGE'),
  publishPolicyHandler
);

apiRouter.post(
  '/policies/:id/evaluate',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_EVALUATE'),
  evaluatePolicyHandler
);

// 7. Semantic Search & Vector Indexing Routes (Sprint 9 - FR-014, FR-020, ADR-002)
apiRouter.get(
  '/search',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  searchHandler
);

apiRouter.post(
  '/search',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  searchHandler
);

apiRouter.post(
  '/search/index/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  indexDocumentHandler
);

// 8. Document Version Comparison Studio Routes (Sprint 9 - FR-012)
apiRouter.get(
  '/compare',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('COMPARE_VIEW'),
  compareDocumentsHandler
);

apiRouter.post(
  '/compare',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('COMPARE_VIEW'),
  compareDocumentsHandler
);

apiRouter.get(
  '/compare/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('COMPARE_VIEW'),
  getComparisonHandler
);

// 9. Grounded Q&A, Retrieval Security & Citation Routes (Sprint 10 - FR-013, FR-015, AI-004, AI-006)
apiRouter.post(
  '/qa/query',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('QA_QUERY'),
  askQuestionHandler
);

apiRouter.get(
  '/qa/documents',
  authenticateJwt,
  enforceTenantIsolation,
  shieldOperatorContent,
  requirePermission('DOC_VIEW'),
  listQaDocumentsHandler
);

apiRouter.post(
  '/qa/citations/verify',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  verifyCitationHandler
);

apiRouter.get(
  '/qa/citations/:documentId/verify',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  verifyCitationHandler
);

apiRouter.post(
  '/qa/traces/:traceId/feedback',
  authenticateJwt,
  enforceTenantIsolation,
  submitFeedbackHandler
);

// 10. Sprint 6 & Sprint 11 — Notifications & Delivery Tracking (FR-016, FR-020, SEC-007)
apiRouter.get(
  '/notifications',
  authenticateJwt,
  enforceTenantIsolation,
  listNotificationsHandler
);
apiRouter.patch(
  '/notifications/:id/read',
  authenticateJwt,
  enforceTenantIsolation,
  markNotificationReadHandler
);
apiRouter.post(
  '/notifications/:id/read',
  authenticateJwt,
  enforceTenantIsolation,
  markNotificationReadHandler
);
apiRouter.post(
  '/notifications/read-all',
  authenticateJwt,
  enforceTenantIsolation,
  markAllNotificationsReadHandler
);
apiRouter.post(
  '/notifications/stream-ticket',
  authenticateJwt,
  enforceTenantIsolation,
  createStreamTicketHandler
);
apiRouter.get(
  '/notifications/stream',
  notificationStreamHandler
);
apiRouter.get(
  '/notifications/preferences',
  authenticateJwt,
  enforceTenantIsolation,
  getPreferencesHandler
);
apiRouter.patch(
  '/notifications/preferences',
  authenticateJwt,
  enforceTenantIsolation,
  updatePreferenceHandler
);

// 11. Sprint 6 & Sprint 11 — Operational Reports & Dashboard KPIs (FR-017, FR-021)
apiRouter.get(
  '/reports/governance',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  getGovernanceReportHandler
);
apiRouter.get(
  '/reports/kpis',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  getOperationalKpiSummaryHandler
);
apiRouter.get(
  '/reports/extraction-quality',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  getExtractionQualityHandler
);

// 12. Sprint 6 & Sprint 11 — Secure Asynchronous Exports & Downloads (FR-018, SEC-008)
apiRouter.post(
  '/exports/request',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  idempotencyMiddleware,
  requestExportHandler
);
apiRouter.get(
  '/exports',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  listExportJobsHandler
);
apiRouter.get(
  '/exports/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  getExportJobHandler
);
apiRouter.get(
  '/exports/:id/download',
  authenticateJwt,
  enforceTenantIsolation,
  downloadExportHandler
);
apiRouter.post(
  '/exports/:id/revoke',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('REPORT_GENERATE'),
  revokeExportHandler
);

// 12.1 OpenAPI 3.1 Specification Endpoint (FR-023 / Part A)
apiRouter.get('/openapi.yaml', (_req, res) => {
  const possiblePaths = [
    path.resolve(process.cwd(), 'openapi.yaml'),
    path.resolve(process.cwd(), 'backend', 'openapi.yaml'),
    path.resolve(process.cwd(), '..', 'openapi.yaml'),
  ];
  const yamlPath = possiblePaths.find((p) => fs.existsSync(p));
  if (yamlPath) {
    res.setHeader('Content-Type', 'text/yaml');
    fs.createReadStream(yamlPath).pipe(res);
  } else {
    res.status(404).send('OpenAPI specification file not found.');
  }
});

// 13. Sprint 11 — Signed Outbound Webhooks (FR-019, SEC-009)
apiRouter.post(
  '/webhooks/subscriptions',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  createSubscriptionHandler
);
apiRouter.get(
  '/webhooks/subscriptions',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  listSubscriptionsHandler
);
apiRouter.delete(
  '/webhooks/subscriptions/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  deleteSubscriptionHandler
);
apiRouter.post(
  '/webhooks/deliveries/:id/retry',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  retryDeliveryHandler
);
apiRouter.get(
  '/webhooks/deliveries',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  getDeliveryHistoryHandler
);

// 14. Sprint 11 — Connector Sandbox & Posting Boundaries (INT-004, SEC-010)
apiRouter.post(
  '/connectors/mappings',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  upsertMappingHandler
);
apiRouter.get(
  '/connectors/mappings',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  getMappingHandler
);
apiRouter.post(
  '/connectors/mappings/:id/sign-off',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  signOffMappingHandler
);
apiRouter.post(
  '/connectors/dispatch',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_APPROVE'),
  dispatchConnectorHandler
);

// 15. Sprint 12 — Retention Policies, Legal Holds & Secure Purge (Tasks 92-99)
apiRouter.get(
  '/retention/policies',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_VIEW'),
  listRetentionPoliciesHandler
);
apiRouter.post(
  '/retention/policies',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('POLICY_MANAGE'),
  upsertRetentionPolicyHandler
);
apiRouter.get(
  '/retention/holds',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  listLegalHoldsHandler
);
apiRouter.post(
  '/retention/holds',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  placeLegalHoldHandler
);
apiRouter.post(
  '/retention/holds/:id/release',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  releaseLegalHoldHandler
);
apiRouter.get(
  '/retention/cases',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  listDeletionCasesHandler
);
apiRouter.post(
  '/retention/cases',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  requestDeletionCaseHandler
);
apiRouter.post(
  '/retention/cases/:id/approve',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  approveDeletionCaseHandler
);
apiRouter.post(
  '/retention/cases/:id/purge',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  executePurgeHandler
);
apiRouter.get(
  '/retention/cases/:id/evidence',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  getPurgeEvidenceHandler
);
apiRouter.get(
  '/retention/ledger',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('ADMIN_ACCESS'),
  listPurgeLedgerHandler
);

// 12. Task Management & Operations (Sprint 7 Part F.1 / FR-011)
apiRouter.get(
  '/tasks',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  listTasksHandler
);

apiRouter.post(
  '/tasks',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  createTaskHandler
);

apiRouter.get(
  '/tasks/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  getTaskHandler
);

apiRouter.patch(
  '/tasks/:id',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_EDIT'),
  updateTaskHandler
);

apiRouter.post(
  '/tasks/:id/comments',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  addTaskCommentHandler
);

apiRouter.get(
  '/tasks/:id/comments',
  authenticateJwt,
  enforceTenantIsolation,
  requirePermission('DOC_VIEW'),
  listTaskCommentsHandler
);
