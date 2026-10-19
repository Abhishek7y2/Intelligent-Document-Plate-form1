# PHASE 2 — COMPLETE BACKEND ARCHITECTURE & CODE AUDIT REPORT

**Target Application:** DocuNexa Enterprise Backend  
**Framework:** Node.js 20+ / Express 4.19 / TypeScript 5.5.2  
**Location:** `document_intelligence_platform-main/backend`  
**Audit Date:** 2026-10-16  
**Auditor Roles:** Principal Software Architect, Application Security Auditor & Senior Node.js Engineer  
**Audit Status:** COMPLETE (Sprint 0C Deliverable)

---

## 1. Executive Summary

An exhaustive, evidence-based code and runtime audit of the DocuNexa backend platform was conducted. The backend consists of **27 Express controllers**, **44 domain services**, **19 domain models/schemas**, and **5 middleware handlers**.

The backend compiles cleanly (`tsc` completed with 0 errors). In test execution, **54 out of 57 test suites passed** and **620 out of 624 unit/integration tests passed**. However, critical architectural risks were uncovered:
1. **Critical Persistence Degradation (P0 - `DEF-002`):** 15 core domain services default to `storeMode = 'memory'`. `server.ts` never initializes database mode, causing total data loss across container or server restarts.
2. **Critical Authentication Backdoors (P0 - `DEF-012`, `DEF-013`):** Hardcoded master OTP passcodes (`742918`, `123456`) and dynamic Admin role escalation for unknown emails containing `"admin"`.
3. **API Contract Mismatch (P0 - `DEF-001`):** Web client uploads to `/documents`, whereas the Express router mounts `/documents/upload`.
4. **Contract Drift (P2 - `DEF-006`):** 6 live Express endpoints are missing from `openapi.yaml`.
5. **Review Workbench Scaling Bug (P2 - `DEF-007`):** Bounding box coordinates calculation fails scale normalization in `review.service.ts`.

---

## 2. Backend Component & Architecture Topology

### 2.1 The 27 Express Controllers
All routes are mounted onto the API router in [`src/routes/api.routes.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/routes/api.routes.ts).

1. `health.controller.ts`: Kubernetes liveness (`/health/live`) and database/redis readiness (`/health/ready`).
2. `auth.controller.ts`: Login, refresh, logout, `/auth/me`, SMTP status, password change, session listing, session revocation.
3. `profile.controller.ts`: Profile retrieval, profile update, avatar upload (multer), binary avatar retrieval.
4. `user.controller.ts`: User invitation, list invitations, revoke invitation, update user role.
5. `document.controller.ts`: Document list, rendered page raster image streaming.
6. `task.controller.ts`: Task CRUD, comment thread addition and retrieval.
7. `schema.controller.ts`: Document types, schema builder, templates draft/publish, policies draft/publish/evaluate.
8. `intake.controller.ts`: Multipart document upload (`/documents/upload`), document retry, document file replace.
9. `review.controller.ts`: HITL review queue, review workbench payload, field correction, review decisions (APPROVE, REJECT, REQUEST_CHANGES).
10. `approval.controller.ts`: Approvals queue, approval/rejection decision submission with Segregation of Duties (SoD).
11. `compare.controller.ts`: Version diffing, text diffing, clause comparison studio.
12. `search.controller.ts`: Full-text and semantic vector search query handler.
13. `qa.controller.ts`: Grounded Q&A question submission, citation verification.
14. `report.controller.ts`: KPI metrics, extraction accuracy analytics, export reports (PDF/CSV/JSON).
15. `admin-telemetry.controller.ts`: System operational telemetry, storage utilization, background queue health.
16. `admin-integrations.controller.ts`: External ERP connectors (SAP, QuickBooks, Salesforce), webhook test pings.
17. `admin-notifications.controller.ts`: Notification templates and delivery configuration.
18. `admin-ai-quality.controller.ts`: Golden set evaluation benchmark runners and F1 reports.
19. `admin-audit.controller.ts`: Immutable audit ledger browser and cryptographic hash chain verification.
20. `admin-operations.controller.ts`: Failed background jobs, dead-letter queues, manual retries.
21. `admin-trace.controller.ts`: Distributed transaction trace visualizer by correlation ID.
22. `retention.controller.ts`: Retention policies, legal hold application, secure purge execution.
23. `security.controller.ts`: Role permission matrix and PII masking configurations.
24. `connector.controller.ts`: ERP outbound publishing triggers.
25. `webhook.controller.ts`: Webhook subscriber registration and delivery verification.
26. `export.controller.ts`: Asynchronous document data export jobs.
27. `outbox.controller.ts`: Transactional outbox polling and retry triggers.

---

### 2.2 The 44 Domain Services Audit & Persistence Mode

A critical finding of this audit is that **15 core domain services** contain dual-mode storage logic (`storeMode = 'memory' | 'database'`), but initialize with `storeMode = 'memory'` by default:

| Service File | Line Citation | Default `storeMode` | Persistence Impact |
| :--- | :--- | :---: | :--- |
| `intake.service.ts` | [`Line 85`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/intake.service.ts#L85) | `'memory'` | Uploaded document metadata and processing state stored in RAM; wiped on reboot. |
| `review.service.ts` | [`Line 28`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/review.service.ts#L28) | `'memory'` | HITL reviewer corrections, annotations, and audit events stored in RAM. |
| `approval.service.ts` | [`Line 58`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/approval.service.ts#L58) | `'memory'` | Approval decisions and SoD audit stamps stored in RAM. |
| `ocr.service.ts` | [`Line 27`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/ocr.service.ts#L27) | `'memory'` | Normalized OCR text tokens and bounding box coordinates stored in RAM. |
| `classification.service.ts` | [`Line 10`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/classification.service.ts#L10) | `'memory'` | Document classification results and confidence scores stored in RAM. |
| `extraction.service.ts` | [`Line 16`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/extraction.service.ts#L16) | `'memory'` | Extracted field key-value pairs stored in RAM. |
| `compare.service.ts` | [`Line 46`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/compare.service.ts#L46) | `'memory'` | Document version comparisons and diff results stored in RAM. |
| `search.service.ts` | [`Line 35`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/search.service.ts#L35) | `'memory'` | Search index and inverted tokens held in RAM instead of pgvector. |
| `qa.service.ts` | [`Line 44`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/qa.service.ts#L44) | `'memory'` | Conversation history and citation links stored in RAM. |
| `report.service.ts` | [`Line 40`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/report.service.ts#L40) | `'memory'` | Aggregated accuracy metrics and KPI statistics computed from RAM. |
| `outbox.service.ts` | [`Line 16`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/outbox.service.ts#L16) | `'memory'` | Transactional outbox events held in RAM; worker polls memory queue. |
| `notification.service.ts` | [`Line 33`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/notification.service.ts#L33) | `'memory'` | In-app alerts and delivery receipts stored in RAM. |
| `webhook.service.ts` | [`Line 22`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/webhook.service.ts#L22) | `'memory'` | Webhook subscription endpoints and retry counters stored in RAM. |
| `export.service.ts` | [`Line 44`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/export.service.ts#L44) | `'memory'` | Export job definitions and output artifacts held in RAM. |
| `connector.service.ts` | [`Line 23`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/connector.service.ts#L23) | `'memory'` | External integration credentials and ERP sync logs held in RAM. |

**Evidence of Startup Omission:**  
In [`src/server.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/server.ts), `validateDatabaseConnection()` validates PostgreSQL connectivity, but `setStoreMode('database')` is **never called** for any service. Consequently, when running `npm start` in development or production, every domain service runs entirely in volatile memory.

---

### 2.3 The 5 Middleware Handlers
1. **`auth.middleware.ts`:**
   - Verifies JWT using `jwt.verify(token, config.jwt.secret)`.
   - Validates user active state and session revocation in real-time (`AuthService.validateUserAndSession`).
   - Normalizes roles and enforces permissions via `requirePermission(perm)` and `requireRole(...roles)`.
   - `shieldOperatorContent`: Blocks `platform_operator` from viewing raw customer document content (BRD Section 3).
   - `enforceTenantIsolation`: Rejects cross-tenant header/query overrides (`x-tenant-id`, `tenantId`).
2. **`correlation.middleware.ts`:**
   - Extracts incoming `x-correlation-id` or generates a UUID v4.
   - Attaches correlation ID to `req.correlationId` and outbound response headers.
3. **`error.middleware.ts`:**
   - Centralized RFC 7807 / RFC 9457 Problem Details error formatter (`type`, `title`, `status`, `detail`, `instance`).
4. **`idempotency.middleware.ts`:**
   - Intercepts mutating POST/PUT requests carrying `Idempotency-Key` header.
   - Caches responses in Redis/Memory to prevent duplicate executions.
5. **`rate-limit.middleware.ts`:**
   - Implements sliding window rate limiting for authentication (`loginRateLimiter`: 5 attempts / 15 mins per IP/email) and general API endpoints.

---

## 3. Test Suite & Build Verification Results

### 3.1 Build Result
- **Command:** `npm run build`
- **Compiler:** TypeScript 5.5.2 (`tsc`)
- **Status:** **SUCCESS (Exit Code 0, 0 Errors)**

### 3.2 Jest Test Suite Execution
- **Command:** `npm test -- --bail=1`
- **Test Suites:** 54 passed, 3 failed, 57 total
- **Tests:** 620 passed, 4 failed, 624 total
- **Execution Time:** ~115s

### 3.3 Failing Test Reproductions & Root Cause Analysis

1. **Test Failure 1: Route Coverage Drift (`src/routes/openapi-routes.spec.ts:42`)**
   - **Failure:** `expect(missingInSpec).toEqual([])`
   - **Received 6 missing routes:**
     - `/auth/change-password`
     - `/auth/sessions`
     - `/auth/sessions/{id}`
     - `/users/profile`
     - `/users/profile/avatar`
     - `/users/profile/avatar/{filename}`
   - **Root Cause:** Sprint 4/Sprint 13 profile and session features were mounted in Express `api.routes.ts` but were not synchronized into `openapi.yaml`.

2. **Test Failure 2: Bounding Box Coordinate Scaling (`src/services/review.service.spec.ts:181`)**
   - **Failure:** `expect(data.boundingBoxes[0]).toHaveProperty('top', 120); Received value: 3.64`
   - **Root Cause:** In [`review.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/review.service.ts), bounding box coordinates are mistakenly scaled by an arbitrary DPI normalization factor twice, resulting in distorted values (`3.64` instead of `120`).

3. **Test Failures 3 & 4: MFA Re-enrollment Handling (`src/services/user-mfa-versioning.spec.ts:248 & 270`)**
   - **Failure:** `Current MFA code or recovery code is required to re-enroll MFA.`
   - **Root Cause:** [`mfa.service.ts:34`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/mfa.service.ts#L34) throws an unhandled error when an already-enrolled user attempts re-enrollment without supplying their current code, whereas the test expects a specific validation error payload.

---

## 4. Key Takeaways for Flutter Mobile Development

1. **Target `/documents/upload`:** Do not target `/documents` for uploads.
2. **Correct Bounding Box Normalization:** Flutter's `InteractiveViewer` and `CustomPainter` overlay must use raw un-skewed coordinates and perform resolution scaling on the client using `MediaQuery.of(context).devicePixelRatio`.
3. **Session Maintenance:** Flutter's `Dio` client must persist `refreshToken` in `FlutterSecureStorage` and handle silent refresh against `POST /api/v1/auth/refresh`.
