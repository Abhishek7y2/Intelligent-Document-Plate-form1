# DocNexa — Audit Evidence Register & Evaluation Limitations (Reconciled Baseline v2.0)

**Document ID:** AUDIT-REP-12-V2  
**Audit Date:** 2026-10-13T18:48:00+05:30  
**Evaluator:** Principal Systems Auditor & Compliance Officer  

---

## 1. Audit Evidence Register

### 1.1 Source Code & Application Files Inspected
- **Frontend Core:**
  - `document-intelligence-ui/src/app/app.routes.ts`: Complete application route table (30 screens).
  - `document-intelligence-ui/src/app/app.config.ts`: Dependency injection tokens and HTTP provider wiring.
  - `document-intelligence-ui/src/app/core/services/api-services.ts`: Abstract contracts for all 9 core services.
  - `document-intelligence-ui/src/app/core/services/http-*.service.ts`: Production implementations making live REST calls.
  - `document-intelligence-ui/src/app/core/services/auth.ts`: Authentication, session storage, and SMTP OTP handlers.
  - `document-intelligence-ui/src/app/features/auth/login/`: Dual-mode login component (password and SMTP OTP).
  - `document-intelligence-ui/src/app/features/review/review-workbench/`: 50/50 split-screen review workspace.
  - `document-intelligence-ui/src/app/features/approvals/`: Multi-tier approvals and Separation of Duties logic.
  - `document-intelligence-ui/src/app/features/compare/`: Side-by-side version comparison studio.
  - `document-intelligence-ui/src/app/features/search/` & `features/qa/`: Semantic search and grounded Q&A (FR-019).
- **Backend Core:**
  - `backend/src/routes/api.routes.ts`: Central route registration (48 endpoints).
  - `backend/src/controllers/auth.controller.ts`: Authentication, OTP generation, verification, and SMTP status handlers.
  - `backend/src/services/email.service.ts`: Nodemailer SMTP integration with TLS transport and sandbox emulation.
  - `backend/src/services/auth.service.ts`: Password verification, OTP verification, JWT signing, refresh token rotation.
  - `backend/src/controllers/approval.controller.ts`: Separation of Duties enforcement and decision audit logging.
  - `backend/src/services/policy-evaluator.ts`: Deterministic invoice arithmetic reconciliation engine.
  - `backend/src/controllers/qa.controller.ts` & `qa.service.ts`: Grounded Q&A with strict page citations and abstention (FR-019).
  - `backend/src/services/outbox.service.ts`: Polling transactional outbox worker.
- **Database & Migrations:**
  - `backend/src/database/migrations/001_initial_schema.sql` through `014_webhooks_audit.sql`: 14 relational migrations.
  - `backend/src/database/postgres.client.ts`: Pooled PostgreSQL 16 client connection.

### 1.2 Automated Test Execution Evidence
- **Backend Jest Suite (`npm test`):**
  - **440 / 440 unique tests passed** (43 test suites, 0 failures, exit code 0).
- **Frontend Vitest Suite (`npx vitest run`):**
  - **41 / 41 unique tests passed** (10 test suites, 0 failures, exit code 0).
- **Total Automated Executed Tests:**
  - **481 unique passed tests** (0 failures, 0 skips, exit code 0).
- **Business Acceptance Scenarios (UAT-01 to UAT-12):**
  - Verified in `backend/src/services/release-sprint13.spec.ts` (Task 100, 12 passing scenarios, Evidence Level E3).

### 1.3 Live Runtime Environment Evidence
- **Frontend Dev Server:** Angular running on `http://localhost:4200` (Task `task-1562`).
- **Backend API Gateway:** Express running in development mode on `http://localhost:8080/api/v1` (Task `task-3038`).
- **Database Engine:** PostgreSQL 16 sandbox container running on port 5434.
- **Browser Interaction Verification:** Subagent verified navigation, DocNexa logo branding, SMTP pill rendering, OTP dispatch, and authentication into `http://localhost:4200/dashboard`.

---

## 2. Evaluation Limitations & Environmental Constraints

1. **Local vs Cloud Multi-Node Staging (Evidence Boundary E3 vs E4):**
   - The entire evaluation was executed against a local containerized test harness (Ports 4200, 8080, 5434).
   - Monthly uptime SLAs (NFR-01: 99.5%) and multi-worker OCR throughput targets (NFR-04) require verification on an authorized multi-node Kubernetes cluster.
2. **Native iOS Mobile Scanner Client (Architecture Extension):**
   - The authoritative BRD specifies multi-channel intake (satisfied by responsive mobile web). Standalone Swift iOS app is an architecture extension (ADR-003, `mobile-architecture.md`) scheduled for Phase 4 delivery and does not block the web staging gate.
3. **External Corporate Inbound Mailbox Polling:**
   - Outbound SMTP sending and login security alerts are fully operational (`nodemailer`). Inbound document intake from IMAP mailboxes has an architectural contract and endpoint, but requires connection to a live corporate IMAP daemon.
4. **Secret Management Protection:**
   - In accordance with security standards, all environment files and secret values were sanitized and omitted from audit records.
