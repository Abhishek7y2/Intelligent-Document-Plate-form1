# CANONICAL API INVENTORY & CONTRACT VERIFICATION REPORT

**Base Path:** `/api/v1`  
**Host:** `http://localhost:8080/api/v1`  
**API Specification Source:** `backend/openapi.yaml` (OpenAPI 3.1.0)  
**Router Source:** `backend/src/routes/api.routes.ts`  
**Frontend Source:** `document-intelligence-ui/src/app/core/services/`  
**Audit Date:** 2026-10-16  
**Auditor:** Principal Backend Architect & API Specialist  
**Status:** COMPLETE (Sprint 0C Deliverable)

---

## 1. Overview & Architecture Standards

DocuNexa exposes a RESTful JSON API following RFC 7807 / RFC 9457 Problem Details for all HTTP 4xx and 5xx error responses.

### 1.1 Cross-Cutting Request Headers
- **`Authorization`:** `Bearer <accessToken>` (Required for all non-public endpoints).
- **`X-Correlation-Id`:** Monotonic or UUID v4 distributed correlation trace identifier.
- **`Idempotency-Key`:** Unique client-generated UUID for non-idempotent operations (POST document upload, review decision, invite user, retry).
- **`Content-Type`:** `application/json` (or `multipart/form-data` for file uploads).

---

## 2. Canonical Endpoint Inventory

The following table provides the verified truth of all backend Express routes, comparing them against `openapi.yaml` and the Angular frontend implementation.

| HTTP Method | Route Path | Controller & Handler | Auth / Role Requirement | Request Schema & Params | Success Response | Contract & Spec Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/health/live` | `health.controller.ts:getLiveness` | Public | None | `200 { status: 'LIVE', timestamp }` | **MATCH** |
| `GET` | `/health/ready` | `health.controller.ts:getReadiness` | Public | None | `200 { status: 'READY', checks: { postgres, redis } }` | **MATCH** |
| `POST` | `/auth/login` | `auth.controller.ts:loginHandler` | Public | `{ email, password, mfaCode? }` | `200 { accessToken, refreshToken, user }` | **MATCH** |
| `POST` | `/auth/request-otp` | `auth.controller.ts:requestOtpHandler` | Public | `{ email }` | `200 { success: true, expiresInSeconds: 300 }` | **MATCH** *(Remediated in Sprint 0D: `testOtp` leak removed)* |
| `POST` | `/auth/verify-otp` | `auth.controller.ts:verifyOtpHandler` | Public | `{ email, code }` | `200 { accessToken, refreshToken, user }` | **MATCH** |
| `GET` | `/auth/smtp-status` | `auth.controller.ts:smtpStatusHandler` | Public | None | `200 { configured, mode, host }` | **MATCH** |
| `POST` | `/auth/refresh` | `auth.controller.ts:refreshHandler` | Public | `{ refreshToken }` | `200 { accessToken, refreshToken, expiresIn }` | **MATCH** |
| `POST` | `/auth/logout` | `auth.controller.ts:logoutHandler` | Authenticated | `{ refreshToken? }` | `200 { message: 'Logged out' }` | **MATCH** |
| `GET` | `/auth/me` | `auth.controller.ts:meHandler` | Authenticated | None | `200 { user, permissions }` | **MATCH** |
| `POST` | `/auth/accept-invite` | `auth.controller.ts:acceptInviteHandler` | Public | `{ token, password, fullName? }` | `200 { accessToken, user }` | **MATCH** |
| `POST` | `/auth/mfa/enroll` | `auth.controller.ts:enrollMfaHandler` | Authenticated | None | `200 { secret, qrCodeUrl, recoveryCodes }` | **MATCH** |
| `POST` | `/auth/mfa/verify-enrollment` | `auth.controller.ts:verifyMfaEnrollmentHandler` | Authenticated | `{ code }` | `200 { success: true, mfaEnabled: true }` | **MATCH** |
| `POST` | `/auth/mfa/disable` | `auth.controller.ts:disableMfaHandler` | Authenticated | `{ currentCode }` | `200 { success: true, mfaEnabled: false }` | **MATCH** |
| `POST` | `/auth/change-password` | `auth.controller.ts:changePasswordHandler` | Authenticated | `{ oldPassword, newPassword }` | `200 { success: true }` | **MISSING IN OPENAPI** |
| `GET` | `/auth/sessions` | `auth.controller.ts:getSessionsHandler` | Authenticated | None | `200 { sessions: [...] }` | **MISSING IN OPENAPI** |
| `DELETE`| `/auth/sessions/:id` | `auth.controller.ts:revokeSessionHandler` | Authenticated | Path: `id` | `200 { success: true }` | **MISSING IN OPENAPI** |
| `GET` | `/users/profile` | `profile.controller.ts:getProfileHandler` | Authenticated | None | `200 { profile }` | **MISSING IN OPENAPI** |
| `PUT` | `/users/profile` | `profile.controller.ts:updateProfileHandler` | Authenticated | `{ fullName, timezone, theme }` | `200 { profile }` | **MISSING IN OPENAPI** |
| `POST` | `/users/profile/avatar` | `profile.controller.ts:uploadAvatarHandler` | Authenticated | `multipart/form-data: file` | `200 { avatarUrl }` | **MISSING IN OPENAPI** |
| `GET` | `/users/profile/avatar/:filename` | `profile.controller.ts:getAvatarBinaryHandler` | Authenticated | Path: `filename` | `200 Binary image/png` | **MISSING IN OPENAPI** *(Remediated in Sprint 0D: Secured with `authenticateJwt` & tenant check)* |
| `GET` | `/roles` | `auth.controller.ts:getRolesHandler` | Authenticated | None | `200 { roles: [...] }` | **MATCH** |
| `POST` | `/users/invite` | `user.controller.ts:inviteUserHandler` | Admin | `{ email, role }` | `200 { invitationId, token, expiresAt }` | **MATCH** |
| `GET` | `/users/invitations` | `user.controller.ts:listInvitationsHandler` | Admin | Query: `limit, offset` | `200 { invitations: [...] }` | **MATCH** |
| `DELETE`| `/users/invitations/:id` | `user.controller.ts:revokeInvitationHandler` | Admin | Path: `id` | `200 { message: 'Revoked' }` | **MATCH** |
| `PATCH`| `/users/:id/role` | `user.controller.ts:updateUserRoleHandler` | Admin | Path: `id`, Body: `{ role }` | `200 { user }` | **MATCH** |
| `POST` | `/documents/upload` | `intake.controller.ts:uploadDocumentHandler` | Contributor, Reviewer, Approver, Admin | `multipart/form-data: file, documentType` | `202 { jobId, documentId, status: 'QUEUED' }` | **MATCH** *(Angular UI calls `/documents`)* |
| `GET` | `/documents` | `document.controller.ts:listDocumentsHandler` | Tenant Roles | Query: `limit, offset, status, type` | `200 { documents: [...], total }` | **MATCH** |
| `GET` | `/documents/:id` | `document.controller.ts:getDocumentByIdHandler` | Tenant Roles | Path: `id` | `200 { document, versions, metadata }` | **MATCH** |
| `GET` | `/documents/:id/pages/:pageNo/image` | `document.controller.ts:getDocumentPageImageHandler` | Tenant Roles | Path: `id, pageNo` | `200 Binary image/png` | **MATCH** |
| `POST` | `/documents/:id/retry` | `intake.controller.ts:retryDocumentHandler` | Tenant Roles | Path: `id` | `202 { documentId, status: 'RETRY_QUEUED' }` | **MATCH** |
| `POST` | `/documents/:id/replace` | `intake.controller.ts:replaceDocumentHandler` | Contributor, Reviewer, Admin | Path: `id`, `multipart: file` | `200 { documentId, newVersion: 2 }` | **MATCH** |
| `GET` | `/documents/:id/attempts` | `intake.controller.ts:listProcessingAttemptsHandler` | Tenant Roles | Path: `id` | `200 { attempts: [...] }` | **MATCH** |
| `DELETE`| `/documents/:id` | *NONE MOUNTED* | N/A | Path: `id` | N/A | **DEAD ROUTE (404)** *(Called by Angular UI)* |
| `GET` | `/review/queue` | `review.controller.ts:getReviewQueueHandler` | Reviewer, Admin | Query: `limit, offset, priority` | `200 { queue: [...] }` | **MATCH** |
| `GET` | `/review/workbench/:id` | `review.controller.ts:getWorkbenchDataHandler` | Reviewer, Admin | Path: `id` | `200 { document, fields, boundingBoxes }` | **MATCH** *(Coordinate scaling bug DEF-007)* |
| `PATCH`| `/review/:id/fields/:key`| `review.controller.ts:correctFieldHandler` | Reviewer, Admin | Path: `id, key`, Body: `{ correctedValue }` | `200 { field, confidence: 1.0 }` | **MATCH** |
| `POST` | `/review/:id/decision` | `review.controller.ts:submitDecisionHandler` | Reviewer, Admin | Path: `id`, Body: `{ action: 'APPROVE'|'REJECT'|'REQUEST_CHANGES', notes? }` | `200 { status, newStage }` | **MATCH** |
| `GET` | `/approvals/queue` | `approval.controller.ts:getApprovalQueueHandler`| Approver, Admin | Query: `limit, offset` | `200 { queue: [...] }` | **MATCH** |
| `POST` | `/approvals/:id/decide` | `approval.controller.ts:submitDecisionHandler` | Approver, Admin | Path: `id`, Body: `{ decision: 'APPROVE'|'REJECT', comments? }` | `200 { approvalStatus, stage }` | **MATCH** |
| `POST` | `/compare` | `compare.controller.ts:compareDocumentsHandler`| Tenant Roles | Body: `{ baseDocId, targetDocId }` | `200 { similarityScore, clauses: [...] }` | **MATCH** |
| `GET` | `/search` | `search.controller.ts:searchHandler` | Tenant Roles | Query: `q, mode: 'keyword'|'semantic'` | `200 { results: [...] }` | **MATCH** |
| `POST` | `/qa/ask` | `qa.controller.ts:askQuestionHandler` | Tenant Roles | Body: `{ question, documentId? }` | `200 { answer, citations: [...] }` | **MATCH** |
| `POST` | `/qa/verify-citation` | `qa.controller.ts:verifyCitationHandler` | Tenant Roles | Body: `{ citationId, boundingBox }` | `200 { verified: true, pageSnippet }` | **MATCH** |
| `GET` | `/tasks` | `task.controller.ts:listTasksHandler` | Tenant Roles | Query: `limit, offset, status, assignee` | `200 { tasks: [...] }` | **MATCH** |
| `POST` | `/tasks` | `task.controller.ts:createTaskHandler` | Tenant Roles | Body: `{ title, documentId, assigneeId }` | `201 { task }` | **MATCH** |
| `GET` | `/tasks/:id` | `task.controller.ts:getTaskHandler` | Tenant Roles | Path: `id` | `200 { task }` | **MATCH** |
| `PATCH`| `/tasks/:id` | `task.controller.ts:updateTaskHandler` | Tenant Roles | Path: `id`, Body: `{ status, priority }` | `200 { task }` | **MATCH** |
| `POST` | `/tasks/:id/comments` | `task.controller.ts:addTaskCommentHandler` | Tenant Roles | Path: `id`, Body: `{ comment }` | `201 { comment }` | **MATCH** |
| `GET` | `/tasks/:id/comments` | `task.controller.ts:listTaskCommentsHandler` | Tenant Roles | Path: `id` | `200 { comments: [...] }` | **MATCH** |
| `GET` | `/reports/kpis` | `report.controller.ts:getKpisHandler` | All Roles | Query: `startDate, endDate` | `200 { metrics: { volume, accuracy, turnaround } }` | **MATCH** |
| `GET` | `/reports/accuracy` | `report.controller.ts:getAccuracyReportHandler`| All Roles | Query: `documentType` | `200 { f1Score, fieldAccuracy: [...] }` | **MATCH** |
| `GET` | `/reports/export` | `report.controller.ts:exportReportHandler` | All Roles | Query: `format: 'csv'|'pdf'|'json'` | `200 Binary file download` | **MATCH** |
| `GET` | `/notifications/stream` | `notification.controller.ts:streamNotificationsHandler` | Authenticated | SSE headers | `200 text/event-stream` | **MATCH** |

---

## 3. Discrepancy & Contract Drift Analysis

### 3.1 Document Upload Route Divergence (`DEF-001`)
- **Backend Router Definition:** `apiRouter.post('/documents/upload', uploadMiddleware, uploadDocumentHandler)` ([`api.routes.ts:358`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/routes/api.routes.ts#L358)).
- **OpenAPI 3.1 Specification:** Registered as `/documents/upload` ([`openapi.yaml:353`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/openapi.yaml#L353)).
- **Angular Frontend Service:** Calls `this.api.post('/documents', formData)` ([`http-document.service.ts:114`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/document-intelligence-ui/src/app/core/services/http-document.service.ts#L114)).
- **Flutter Mobile Client Action:** Must target `/api/v1/documents/upload` directly.

### 3.2 Missing Document Deletion Route (`DEF-003`)
- **Backend Reality:** Express router does not mount any `DELETE /documents/:id` handler.
- **Angular Frontend Service:** Declares `deleteDocument(id: string)` invoking `DELETE /documents/${id}` ([`http-document.service.ts:85`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/document-intelligence-ui/src/app/core/services/http-document.service.ts#L85)).
- **Flutter Mobile Client Action:** Document soft-deletion is unsupported by backend API; omit delete option or tie into legal retention purge workflows (`/admin/retention`).

### 3.3 Unsynchronized Express Endpoints Missing from OpenAPI (`DEF-006`)
Verified by the failing test `src/routes/openapi-routes.spec.ts:42`, 6 routes are mounted in Express but missing from `openapi.yaml`:
1. `/auth/change-password` (`POST`)
2. `/auth/sessions` (`GET`)
3. `/auth/sessions/{id}` (`DELETE`)
4. `/users/profile` (`GET`, `PUT`)
5. `/users/profile/avatar` (`POST`)
6. `/users/profile/avatar/{filename}` (`GET`)
