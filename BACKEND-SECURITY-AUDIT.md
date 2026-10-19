# DocuNexa Enterprise Backend & Application Security Audit

**Audit type:** Initial read-only static audit and focused authentication regression check  
**Audit date:** 2026-10-16  
**Reviewed revision:** `e9e2d4999e2ab38e0c6e46c050ebcaef82c18590` (`feature/profile-authentication`)  
**Repository root:** `C:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main`  
**Application source root:** `document_intelligence_platform-main\`  
**Status:** Initial pass; release readiness not established  
**Change boundary:** No application source, configuration, dependency manifest, or database was modified. This Markdown report is the only requested deliverable.

## 1. Executive summary

DocuNexa is a substantial document-processing and governance application: an Angular web UI, a TypeScript/Express API, PostgreSQL migrations, optional MongoDB derived-data support, S3-compatible storage, Redis/BullMQ workers, OCR and malware-scanning adapters, and services for review, approval, search, Q&A, exports, webhooks, and retention are present in the repository.

**Release decision: NO-GO for production authentication or customer-data processing until P0/P1 findings are remediated and retested.** The most serious confirmed issue is an unauthenticated OTP login flow that returns the OTP in the API response and accepts fixed OTP values; its verification path can create an in-memory user and assign an administrator role based on the requested email. A second confirmed issue is unconditional in-memory test-user seeding and authentication fallback. These controls can bypass normal password and account-provisioning controls.

There is also a critical architectural readiness concern: business services default to process-local stores, while the API server and dedicated worker are separate processes. The normal server/worker entry points do not visibly initialize all these services for durable database mode. In addition, the production Compose example supplies database connection settings in a form the current PostgreSQL client does not consume, and the migration runner is hard-bound to a sandbox database. These findings mean the repository does not demonstrate a working production deployment path.

This is **not** a penetration test, a full line-by-line source audit, a compliance attestation, or verification of cloud/staging runtime behavior. Test claims in existing reports were not accepted as current evidence. The only test execution performed for this report is recorded in §10.

## 2. Scope, method, and evidence hierarchy

### Scope reviewed

- Root repository, application subdirectory, Git state, manifests, lockfiles, CI and Compose files.
- Project overview, functional and non-functional requirements, architecture documents, OpenAPI specification presence, prior audit reports, and test evidence claims.
- Backend entry points, central route registration, authentication/authorization middleware, OTP and MFA services, service storage-mode declarations, worker/outbox setup, database client/migration runner, selected service flows for intake/OCR/extraction/review/approval/search/Q&A/retention, and relevant tests.
- Frontend route/service wiring as application context and to identify mismatches between UI claims and backend boundaries.

### Method and constraints

- Read-only inspection. No migration, database modification, secret-file inspection, source-code edits, dependency installation, or external service connection.
- Reviewed source behavior rather than treating method/route presence, badges, or audit-report percentages as proof of acceptance.
- Ran only the focused backend auth test command shown in §10.
- Finding severity labels P0–P3 express remediation priority; confidence is listed separately. “Confirmed” means the unsafe behavior is visible in source, not that an external attacker successfully exploited a live deployment.

### Evidence hierarchy

1. Current source, route registrations, migrations, manifests, CI and deployment files.
2. Functional requirements and NFRs in `docs/`.
3. Prior audit reports and README badges, treated as claims requiring corroboration.

## 3. Repository and authoritative-document inventory

The repository root contains the application under `document_intelligence_platform-main\`, plus root documentation, CI, Compose, performance-testing material, screenshots, and two sets of prior audit reports.

Primary documents consulted:

- `docs/01-project-overview.md`
- `docs/04-functional-requirements.md` (FR-001–FR-023)
- `docs/05-non-functional-requirements.md`
- `docs/ARCHITECTURE.md`
- `docs/architecture/` (system, security, database, backend, deployment, AI, frontend, application, admin, and mobile architecture documents)
- `audit-reports-v2/01-executive-audit-report.md`
- `audit-reports-v2/02-brd-compliance-matrix.csv`
- `audit-reports-v2/05-backend-api-audit.md`
- `audit-reports-v2/06-database-architecture-audit.md`
- `audit-reports-v2/07-ai-security-audit.md`
- `audit-reports-v2/08-testing-uat-report.md`
- `audit-reports-v2/12-audit-evidence-and-limitations.md`
- `README.md`, both package manifests and lockfiles, OpenAPI specification, migrations, Dockerfiles, Compose files, and CI workflows.

### Baseline conflicts requiring governance

The repository does not have a single internally consistent requirement baseline:

- `docs/04-functional-requirements.md` defines FR-013 as grounded conversational Q&A and FR-019 as a native iOS scanner/review application.
- The v2 audit reports assign different meanings to some IDs, including FR-019 as grounded Q&A, and reclassify native iOS as optional.
- The main README and older architecture documents describe native iOS as part of the technology stack; the CI workflow says the iOS Xcode project scaffold is pending. No Swift files were found.
- `docs/05-non-functional-requirements.md` specifies RS256, 15-minute access tokens, HttpOnly secure refresh cookies, database RLS, TLS 1.3, 99.9% availability, RPO ≤15 minutes, and RTO ≤1 hour. Inspected code instead uses HS256 bearer tokens and body-carried refresh tokens; no RLS migration statements were found. Cloud SLA evidence was not available.
- README and audit reports publish different test totals and runtime versions. These totals are not accepted as current results unless independently rerun against the same revision.

The project owner should approve a versioned BRD/PRD baseline and a requirement-ID mapping before formal compliance sign-off.

## 4. Architecture and dependency map

```text
Angular web application
  ├─ lazy-loaded feature routes, guards, UI service contracts
  └─ HTTP API client + correlation/auth interceptors
         │ /api/v1
         ▼
Express API process
  ├─ correlation, Helmet, CORS, compression, body parsing, metrics, errors
  ├─ authentication, tenant checks, permissions, request handlers
  ├─ domain services: intake, OCR, classification, extraction, review,
  │  approvals, search, Q&A, exports, reports, webhooks, retention, admin
  ├─ PostgreSQL client and migrations
  ├─ object storage adapters: S3-compatible, local filesystem, memory
  └─ outbox publisher
         │ PostgreSQL outbox / Redis BullMQ
         ▼
Dedicated worker process
  ├─ OCR, extraction and webhook jobs
  ├─ scheduled IMAP mailbox intake
  ├─ expiry notification / idempotency maintenance
  └─ transactional outbox poller

External or supporting services: PostgreSQL + pgvector, Redis, MongoDB (optional
derived store), MinIO/AWS S3, ClamAV, SMTP/IMAP, optional external OCR/LLM APIs.
```

### Runtime and framework inventory

| Area | Repository evidence | Audit observation |
|---|---|---|
| Backend | Node.js/TypeScript, Express 4; `backend/package.json` | API and worker are separate entry points. |
| Web frontend | Angular standalone application; UI `package.json` specifies Angular 22.2 | README and CI labels describe Angular 19; reconcile runtime documentation. |
| Relational data | PostgreSQL client (`pg`) and SQL migration set under `backend/src/database/migrations/` | Migrations cover identity, documents, OCR, review, search, outbox, retention and profile extensions. |
| Derived data | MongoDB client/repository (`mongo.client.ts`, `derived-data.repository.ts`) | Optional modes exist; Mongo fallback behavior is configuration-sensitive. |
| Queueing | Redis/ioredis + BullMQ (`queue.service.ts`, `worker.ts`) | Worker uses concurrency 3; scheduled jobs and outbox polling are implemented. |
| Object storage | S3-compatible, local and memory adapters (`storage.service.ts`) | Runtime driver configuration and durable metadata wiring require release verification. |
| OCR and malware | Tesseract, Gemini and mock OCR adapters; ClamAV and mock scanner | Adapter implementations exist; real provider operation depends on configuration and service health. |
| CI/CD | GitHub Actions and GitLab CI | CI checks differ; dependency-audit failures are ignored in GitLab and deployment jobs include placeholders. |
| Deployment | Sandbox Compose, production-example Compose, backend/frontend Dockerfiles | No Kubernetes or Terraform manifests were found in the application directory. |
| Native mobile | Architecture/README references | No Swift source or Xcode project was found; CI explicitly treats scaffold as pending. |

### Module inventory

| Module | Principal code | Current implementation evidence |
|---|---|---|
| Bootstrap/API | `backend/src/app.ts`, `server.ts`, `routes/api.routes.ts` | Express middleware, API mounting, health/metrics/OpenAPI and centralized routes. |
| Identity | `controllers/auth.controller.ts`, `services/auth.service.ts`, `services/mfa.service.ts`, `middleware/auth.middleware.ts` | Password login, OTP login, JWT/session lifecycle, MFA enrollment, invitations and profile/session endpoints. |
| Tenant and permissions | `middleware/auth.middleware.ts`, `models/auth.models.ts`, role/permission models | Tenant override checks and permission middleware; persistence-layer RLS not found. |
| Intake/file security | `controllers/intake.controller.ts`, `services/intake.service.ts`, `services/storage.service.ts`, `services/scanner.service.ts`, `utils/file-validator.ts` | Upload, file validation, hashing, scanner/storage adapters, retries and versions. |
| OCR/AI | `services/ocr.service.ts`, OCR adapters, `classification.service.ts`, `extraction.service.ts`, `model-provider.service.ts`, `embedding.service.ts` | OCR geometry, rule-based classification, template extraction, embeddings, summaries and grounded Q&A abstractions. |
| Review/governance | `review.service.ts`, `approval.service.ts`, policy and math utilities | Corrections, review decisions, threshold-based approval and SoD checks. |
| Search/compare/QA | `search.service.ts`, `compare.service.ts`, `qa.service.ts` | Hybrid search, vector indexing, comparisons, cited Q&A and trace records. |
| Async processing | `outbox.service.ts`, `outbox-poller.service.ts`, `queue.service.ts`, `worker.ts`, `workers/job-processors.ts` | Outbox to BullMQ dispatch, retries, OCR/extraction/webhook processing and scheduled jobs. |
| Integrations/operations | `email-intake.service.ts`, webhook/connector/ERP services, reports, exports, notifications, retention | Multiple API/service implementations; live endpoints and operational configuration need deployment evidence. |
| Frontend | `document-intelligence-ui/src/app/` | Protected route tree and HTTP services for core platform screens; not a substitute for backend authorization. |

## 5. Request and data-flow traces

### 5.1 Password login

`POST /api/v1/auth/login` → IP rate limiter → `loginHandler` validates presence of email/password → `AuthService.login` loads user, verifies password, checks MFA when enabled, creates access/refresh tokens and session → response returns token pair in JSON.

**Controls present:** rate-limited route, password verification, token algorithm pinning in middleware, session validation and MFA-aware password-login branch.

**Gaps:** the separate OTP path bypasses this trust chain (SEC-001); authentication service contains production-capable in-memory fallbacks and seeded users (SEC-002); refresh token is returned in JSON rather than the HttpOnly cookie specified by NFR; production session persistence is not demonstrated.

### 5.2 Email OTP login

`POST /api/v1/auth/request-otp` → IP limiter → `requestOtpHandler` → `EmailService.sendLoginOtpEmail` generates code, stores it in process memory, dispatches email or reports sandbox success → handler returns `testOtp` in JSON.

`POST /api/v1/auth/verify-otp` → IP limiter → `verifyOtpHandler` → `EmailService.verifyLoginOtp` accepts fixed values → `AuthService.loginWithEmailOnly` loads or creates an in-memory account, assigning Admin when requested address includes `admin` → new session and JWT returned.

**Result:** unauthenticated caller can obtain the OTP through the request response or use fixed codes; email-only path is not limited to an existing account and does not apply MFA. This is a confirmed authentication bypass, SEC-001.

### 5.3 Document upload and background processing

`POST /api/v1/documents/upload` → JWT → tenant isolation → `DOC_UPLOAD` permission → rate limit → multipart middleware → idempotency middleware → upload controller → intake validation, malware scan, hash, storage, metadata/outbox event → worker polls outbox and enqueues OCR → OCR worker loads stored binary, normalizes OCR/layout, updates status and emits extraction event → extraction worker applies template/math validation → review or straight-through status.

**Controls present:** route-level authentication/permission/tenant middleware, upload limits and file validation, scanner adapter, object-storage adapter, tenant-bearing job data, outbox and retry infrastructure.

**Gaps/risks:** upload middleware buffers content in memory, raising resource-exhaustion risk at concurrency; core stores default to process memory and are not visibly configured to database mode in the normal server/worker bootstrap (ARCH-001); outbox mode/wiring must be verified across processes. Production malware scan fail-closed behavior and actual object-store permissions were not runtime-tested.

### 5.4 Review and approval

Review queue/detail routes → auth → tenant check → operator-content shield → permission → review service → field correction/audit and decision. Approval queue/decision routes similarly apply tenant and operator checks; `DOC_APPROVE` gates decisions, with SoD evaluated by `ApprovalService`.

**Controls present:** explicit service-level SoD logic comparing submitter/reviewer to approver; approval tiering and persistent schema structures.

**Not established:** complete live database concurrency semantics, immutable audit guarantees, and whether all approval transitions use one atomic transaction under concurrent decisions. Existing source has memory-backed approval state by default.

### 5.5 Search and grounded Q&A

Search route → JWT → tenant check → `DOC_VIEW` → search service → full-text/vector retrieval. Q&A route adds operator-content shield and `QA_QUERY`; service filters eligible tenant documents, retrieves chunks, calls configured model provider, maps citations, records trace/feedback.

**Controls present:** tenant ID is passed through retrieval and derived-data repository enforces tenant IDs; Q&A has citation and abstention concepts and provider abstraction.

**Risks/unknowns:** default model/embedding providers are synthetic; external-provider configuration and data egress policy require verification. Citation fidelity, prompt-injection resistance, and tenant isolation need integrated negative tests, not method-existence claims.

### 5.6 IMAP intake and retention

IMAP worker polls enabled mailboxes → parses mail/attachments → maps recipient to tenant mailbox → filters sender domain/size/count → deduplicates Message-ID → sends attachments through intake. Retention APIs create policies, holds, deletion cases and purge evidence.

**Controls present:** mailbox-to-tenant mapping, sender-domain allowlist, attachment constraints and post-process message marking. Retention schema includes legal holds and deletion cases.

**Not established:** production IMAP/SMTP connectivity, end-to-end idempotency under DB failures, scheduled expiry/purge execution, and atomic enforcement of legal holds against concurrent purge operations. Do not infer those guarantees solely from schema or endpoint existence.

## 6. API inventory and authorization model

The central inventory is `backend/src/routes/api.routes.ts`. The route file registers the following families:

| Route family | Representative paths | Typical middleware observed | Assessment |
|---|---|---|---|
| Health/ready | `/health`, `/ready` (plus top-level liveness/readiness/metrics in app) | Public | Expected operational exposure; validate data returned by health/metrics in production. |
| Authentication | `/auth/login`, `/auth/request-otp`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`, `/auth/me` | Login/OTP rate limit; bearer auth for protected session/profile paths | OTP token-issuance flow is critically unsafe. |
| User/profile/admin | `/users/profile`, `/users/invite`, `/users/:id/role`, `/admin/*` | JWT, tenant check, permissions on most admin routes | Several handlers add their own role checks; audit all role aliases and target-object tenant checks. |
| Documents/intake | `/documents/upload`, `/documents/:id`, versions, attempts, retries, pages/images | JWT, tenant check, action permissions, upload rate limit, idempotency | Broad surface; request-buffer resource limits and persistence wiring are P1 operational concerns. |
| OCR/classification/extraction | `/documents/:id/process-ocr`, `/classify`, `/extract`, geometry/results | JWT, tenant check, `DOC_VIEW`/`DOC_EDIT` | Verify consistent status gates and tenant-scoped SQL for all reads/writes. |
| Review/approvals/ERP | `/review/*`, `/approvals/*`, `/erp/*` | JWT, tenant check, operator shield, permission | SoD service exists; concurrent decision atomicity not verified. |
| Search/compare/Q&A | `/search`, `/compare`, `/qa/*` | JWT, tenant check, content shield for selected Q&A routes, permissions | Public exposure not seen here; downstream provider/citation guarantees need integration evidence. |
| Reports/exports/notifications | `/reports/*`, `/exports/*`, `/notifications/*` | JWT, tenant check, permissions for many endpoints | Verify export masking and signed/download URL expiry; stream-ticket route is a special auth boundary. |
| Webhooks/connectors | `/webhooks/*`, `/connectors/*` | JWT, tenant check, admin/approval permission | Review outbound destination validation and SSRF controls before enabling arbitrary endpoints. |
| Retention | `/retention/policies`, `/holds`, `/cases`, `/purge`, `/ledger` | JWT, tenant check, policy/admin permissions | High-impact irreversible operations; require atomic hold check, authorization and approval verification. |
| Documentation/avatar | `/openapi.yaml`, `/users/profile/avatar/:filename` | OpenAPI route public; avatar route appears public | Confirm document/spec does not expose secrets and avatar IDs cannot disclose private content. |

`authenticateJwt` pins HS256 and checks essential user/tenant/role claims, then calls `AuthService.validateUserAndSession`. `enforceTenantIsolation` rejects client-supplied tenant overrides that differ from the JWT tenant. `requirePermission` checks permissions on `req.user`. These are useful application-layer controls, but they do not establish PostgreSQL RLS. Each controller/service still needs object-level ownership and tenant-scoped query verification.

## 7. Authentication, authorization, and tenant isolation

### Strengths in source

- JWT verification restricts accepted algorithm to HS256 and validates required identity claims.
- Role permissions are represented centrally and applied to most business routes.
- Tenant context comes from authenticated JWT; explicit client tenant overrides are rejected.
- Platform-operator content shielding exists for selected document workflows.
- Password-based login has a distinct MFA-aware path; TOTP enrollment encrypts stored secrets and generates hashed recovery codes.
- Refresh-token rotation, token-family tracking, and database transaction logic are present.

### Material weaknesses

- **SEC-001:** public OTP route returns the secret and permits token issuance through an email-only path; arbitrary email can map to a newly created in-memory user/role.
- **SEC-002:** seed test users load unconditionally; authentication/database/session failures can fall back to memory.
- JWT algorithm and storage architecture conflict with the NFR baseline: HS256 bearer token; body refresh token; no RLS statements found.
- Session validation returns valid if no database user row exists and no matching in-memory user is found, after DB errors or missing session lookups; threat impact depends on token issuance and runtime paths. This warrants dedicated negative tests and fail-closed behavior.
- Several service/controller methods suppress database failures and fall back to memory or success-shaped responses. That is unsafe for auth state, MFA enrollment, revocation, idempotency and data integrity; a full call-site audit remains required.
- Rate limiter uses PostgreSQL by default but deliberately falls back to process-local memory on DB failures, weakening cluster-wide brute-force limits during a database incident.

## 8. Database and data-protection audit

### Schema and migrations

- PostgreSQL schema/migrations are present under `backend/src/database/migrations/`; numbered migrations extend through 026, with rollback scripts for selected migrations.
- The vector migration creates `vector(1536)`, full-text tsvector/Gin indexing, and HNSW indexing.
- Migrations cover identities/sessions, document records, OCR pages/geometry, extraction, audit, approvals/ERP, search/compare, outbox, Q&A traces, notifications/reports/exports/webhooks, retention/legal hold/purge, idempotency, profiles, and derived-store support.
- No `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, or `FORCE ROW LEVEL SECURITY` statements were found in the inspected migration directory. This conflicts with the NFR security baseline.
- Migration runner `src/database/migrations/migrate.ts` has a sandbox-only preflight requiring port 5434, database `docunexa_sandbox`, PostgreSQL 16 and pgvector. It is not a production migration mechanism.

### Connection/deployment mismatch

`docker-compose.prod.example.yml` provides `DATABASE_URL`; `env.config.ts` and `postgres.client.ts` use discrete host/port/user/password/database variables and do not parse `DATABASE_URL`. In the shown Compose environment, absent additional variables, the application falls back to localhost defaults. The same production example has no schema-migration stage, while the migration runner disallows a production database. This is a **release-blocking configuration issue (CFG-001)**.

### Tenant data integrity

- Many services issue parameterized SQL and include tenant IDs in query predicates; these patterns are positive.
- Application middleware tenant checks do not protect direct SQL access, accidental unscoped queries, background tasks, or future services. Database RLS is not present in inspected migrations.
- Mongo repository requires tenant ID for its operations, but Mongo behavior is optional and dependent on connected mode.
- `documents` tables and derived records have tenant columns, but not all cross-table tenant relationships are shown to have composite constraints. Full relational integrity and every query were not exhaustively audited.

### Encryption and retention

- AES-GCM utility and encrypted MFA secret storage are present; S3-compatible storage supports endpoint/credentials configuration. Actual encryption-at-rest, TLS posture and IAM policy were not verified.
- PostgreSQL optional TLS client uses `rejectUnauthorized: false`; SMTP transport also disables certificate verification. This enables trusting invalid certificates and is reported as SEC-003.
- Retention/hold/purge data models and service APIs exist, but no end-to-end purge execution or restore drill was run. The NFR claims of zero-fill overwrite and cryptographic deletion are not validated; object deletion on S3 generally needs storage-specific lifecycle/versioning evidence, not a schema row alone.
- No database backup/restore command or cloud DR execution was run during this audit.

## 9. Requirements traceability (initial pass)

**Status definitions:** PASS = implementation and acceptance evidence verified; FAIL = observed behavior violates acceptance criteria; PARTIAL = some behavior exists but required behavior is missing/contradictory; NOT VERIFIED = source/test evidence is insufficient. A route or component alone is not a PASS. Because the requirement documents conflict, the following uses `docs/04-functional-requirements.md` IDs and flags mismatches.

| Requirement | Expected outcome (summary) | Source evidence reviewed | Test/evidence | Status | Gap / action |
|---|---|---|---|---|---|
| FR-001 | Web/API/email/mobile multi-channel intake | Intake service, upload routes, IMAP service; no Swift source | Focused tests not run | PARTIAL | Native client absent; email deployment/config not verified. |
| FR-002 | Malware scan and quarantine before processing | Scanner and intake services, upload route | Scanner tests exist; not run | PARTIAL | Production ClamAV fail-closed deployment not exercised. |
| FR-003 | OCR text, layout geometry and metadata | Tesseract/Gemini/mock adapters and OCR service | OCR specs exist; not run | PARTIAL | Accuracy, 300 DPI, orientation/deskew and per-page acceptance not measured. |
| FR-004 | Document classification with uncertainty routing | Rule-based classifier and service | Classification tests exist; not run | PARTIAL | Documented ML/layout model and calibration are not established by rule-based implementation. |
| FR-005 | Layout-aware key/value and table extraction | Template-driven extractor and schema service | Extraction tests exist; not run | PARTIAL | Universal/layout transformer extraction not evidenced; templates required. |
| FR-006 | Every extracted value tied to visual evidence | OCR geometry and review UI/service | OCR/review tests exist; not run | PARTIAL | End-to-end evidence coverage for all fields not demonstrated. |
| FR-007 | Deterministic financial validation | Invoice reconciliation utility and extraction service | Extraction tests exist; not run | PARTIAL | Full line-item/subtotal/tax/shipping acceptance behavior not independently verified. |
| FR-008 | HITL queue and field correction/audit | Review service/controller/UI | Review tests exist; not run | PARTIAL | Persistence mode, audit completeness, optimistic concurrency need validation. |
| FR-009 | Configurable independent QA sampling | Requirements/doc UI claims | No QA engine execution evidence reviewed | NOT VERIFIED | Verify sampling scheduler, independent role and quality outputs. |
| FR-010 | Submitter/reviewer cannot approve | `ApprovalService.evaluateSod` | Approval tests exist; not run | PARTIAL | Logic exists; cross-process/database concurrency and all aliases require integration tests. |
| FR-011 | Multi-level threshold approval and comments | Approval service/model/routes | Approval tests exist; not run | PARTIAL | Mandatory comments and sequential/parallel workflow acceptance not proven. |
| FR-012 | Version side-by-side comparison/redlines | Compare service/UI/routes | Compare tests exist; not run | PARTIAL | Legal clause fidelity and source-version integrity not measured. |
| FR-013 | Grounded conversational Q&A with citations | `QaService`, model provider, Q&A routes | QA security/eval tests exist; not run | PARTIAL | Synthetic provider default; citation correctness and external model configuration not validated. |
| FR-014 | Tenant-protected hybrid search | Search/embedding service and pgvector migration | Search tests exist; not run | PARTIAL | Real embeddings/provider selection and cross-tenant integration test not executed. |
| FR-015 | RBAC over application operations | JWT middleware, permissions and routes | Security containment tests run; see §10 | PARTIAL | Critical unauthenticated OTP bypass defeats intended policy; RLS absent. |
| FR-016 | Retention scheduler and expiry processing | Retention service, migration, maintenance worker | No purge end-to-end test run | PARTIAL | Automatic expiry and production scheduling not demonstrated. |
| FR-017 | Legal hold blocks purge | Retention service and hold schema | No concurrency/purge test run | PARTIAL | Atomic hold-vs-purge invariant not verified. |
| FR-018 | Secure purge with deletion evidence | Purge services/schema/API | No live storage purge test run | PARTIAL | Zero-fill and cryptographic erasure claims not evidenced for actual object stores/backups. |
| FR-019 | Native iOS scanner/review client (as defined in docs/04) | No Swift sources/Xcode project | Repository inspection | FAIL | Native app is not present; prior audit reclassifies this ID and conflicts with BRD. |
| FR-020 | PostgreSQL persistence with pgvector | SQL migrations and pgvector schema | No live DB validation | PARTIAL | DB support exists; production connection/migration path and runtime store mode are not wired/evidenced. |
| FR-021 | API microservices/workers/webhooks | Express API, BullMQ worker and outbox source | Two auth tests only run | PARTIAL | Service boundaries and production queue/outbox persistence not proven end to end. |
| FR-022 | Immutable, complete audit events | Audit service/schema and admin trace | No immutability/tamper test run | PARTIAL | Database-level immutability, read/export event completeness and retention not verified. |
| FR-023 | Health and performance monitoring | Health and metrics endpoints/services | No runtime/metrics validation | PARTIAL | Health code exists; SLA dashboards/telemetry target evidence absent. |

### Non-functional requirements

| NFR area | Baseline requirement | Evidence/status |
|---|---|---|
| Latency/throughput | API, upload, OCR, search targets and worker scaling | **NOT VERIFIED**; performance-testing assets exist but no current execution output was independently checked. |
| Availability/DR | 99.9% uptime, RTO ≤1h, RPO ≤15m | **NOT VERIFIED**; no cloud deployment/restore evidence in this audit. |
| Transport/security | TLS 1.3, HSTS, RS256, short-lived token, secure refresh cookie | **FAIL/PARTIAL**; HS256 and JSON token responses observed; SMTP/Postgres TLS certificate validation disabled. TLS 1.3/HSTS not established. |
| Tenant isolation | PostgreSQL RLS plus organization middleware | **PARTIAL/FAIL against stated architecture**; application tenant checks exist; no RLS statements found. |
| Governance | SOC 2, GDPR/CCPA purge, HIPAA redaction | **NOT VERIFIED**; feature code/schema is not compliance certification or operational evidence. |
| Accessibility | WCAG 2.1 AA | **NOT VERIFIED**; no accessibility audit/evidence run. |

## 10. Security findings register

### Severity summary

| ID | Severity | Finding | Confidence | Release blocking |
|---|---|---|---:|---|
| SEC-001 | P0 / CRITICAL | Public OTP issuance/verification bypasses account proof and normal MFA | 10/10 | Yes |
| SEC-002 | P1 / HIGH | Test identities and in-memory authentication fallback are enabled outside isolated tests | 9/10 | Yes |
| SEC-003 | P2 / MEDIUM | SMTP and optional PostgreSQL TLS accept untrusted certificates | 8/10 | No (must fix before production credentials/data traverse affected path) |
| ARCH-001 | P1 / HIGH risk | Business stores default to process memory without visible production wiring | 9/10 | Yes |
| CFG-001 | P1 / HIGH config | Production database Compose variables and sandbox-only migration guard do not form a deployable DB path | 9/10 | Yes |
| CFG-002 | P2 / MEDIUM process | CI dependency audits are non-blocking and staging deploy/rollback jobs are placeholders | 9/10 | No |

### SEC-001 — Public OTP flow issues privileged tokens without mailbox or MFA proof

- **Type:** Confirmed authentication bypass / account provisioning and privilege escalation.
- **Evidence:** `backend/src/routes/api.routes.ts` registers `/auth/request-otp` and `/auth/verify-otp` without authentication; `controllers/auth.controller.ts` returns `testOtp` and calls `AuthService.loginWithEmailOnly`; `services/email.service.ts` accepts fixed demo values; `services/auth.service.ts` creates an in-memory user for an unknown email and selects Admin when the email contains `admin`.
- **Reproducible source-level scenario:** Request OTP for an attacker-selected address, read the code from the response or submit a fixed accepted code, then verify. `loginWithEmailOnly` can provision an in-memory user and return a JWT with role-derived permissions. No live exploit was performed.
- **Preconditions:** API reachable; public route enabled (as registered). SMTP need not be the only source of the OTP because the response includes it and fixed values are accepted.
- **Root cause:** Test/demo OTP exposure and permissive email-only login were included in a production-capable route; account creation and role assignment happen at authentication time.
- **Impact:** Unauthenticated token issuance, administrator impersonation and access to protected tenant operations; critical confidentiality, integrity and authorization risk.
- **Remediation:** Remove OTP from response and eliminate fixed codes outside isolated test fixtures; require an existing active account with verified email ownership; do not derive role or tenant from requester-controlled email; do not permit email-only login to bypass MFA. Fail closed if mail delivery/verification fails. Review all token-issuing paths.
- **Regression tests:** Production-mode route integration test asserts no code appears in response, fixed codes fail, unknown emails cannot obtain token, account role/tenant cannot be requester-controlled, MFA-enabled account cannot bypass MFA, and SMTP outage does not issue a success-shaped authentication result.
- **Priority:** P0; block production release and revoke/invalidate any tokens issued through the affected path if this endpoint has been exposed.

### SEC-002 — Test identities and authentication fallback enabled outside isolated tests

- **Type:** Confirmed insecure authentication fallback.
- **Evidence:** `backend/src/services/auth.service.ts` defines `seedTestUsers()`, invokes it at module load, uses a fixed source-defined test password for seeded users, and uses in-memory users/sessions when DB lookup/session operations fail. `AuthService.isDatabaseMode()` disables the database path only for test mode unless configured otherwise; the module-level seed itself is not similarly gated.
- **Scenario:** A seeded in-memory identity can be considered when a DB lookup finds no user, and a database outage can switch authentication/session checks to process memory. A source-known test password plus a seeded elevated role can then authenticate if the code path is reached.
- **Preconditions:** Authentication code deployed with module seed active; database record absent or relevant DB call fails.
- **Root cause:** Test convenience state and production fallback share the same authentication service.
- **Impact:** Potential account impersonation/privilege escalation; authentication and session revocation become inconsistent across replicas/restarts.
- **Remediation:** Remove in-memory seeded identities from production modules; seed only through test fixtures; fail closed on auth DB/session failures in production; ensure session must be found and valid in authoritative persistent storage.
- **Regression tests:** `NODE_ENV=production` test verifies no seed identities exist and missing database users/session rows and DB errors cannot authenticate or pass JWT validation.
- **Priority:** P1; release-blocking.

### SEC-003 — SMTP and optional PostgreSQL TLS accept untrusted certificates

- **Type:** Confirmed transport-validation weakness; exploitability requires network position or endpoint impersonation.
- **Evidence:** `backend/src/services/email.service.ts` configures `tls.rejectUnauthorized: false`. `backend/src/database/postgres.client.ts` sets SSL with `rejectUnauthorized: false` when `DB_SSL` is enabled. `env.config.ts` makes SMTP `secure` configurable rather than requiring TLS for production.
- **Scenario:** An on-path attacker or compromised network endpoint can present an invalid certificate; the client does not reject it. If SMTP transport is configured without implicit TLS or enforced STARTTLS, credentials or OTP traffic could be exposed depending on server negotiation.
- **Impact:** Credential/OTP interception, email redirection or database traffic interception under relevant deployment conditions.
- **Remediation:** Require authenticated TLS in production; validate server certificates and hostname; provide an explicit trusted CA path for private PKI rather than disabling validation; make insecure transport a development-only setting.
- **Regression tests:** Mail and DB integration tests reject self-signed/untrusted and hostname-mismatched certificates in production configuration and require encrypted connections.
- **Priority:** P2; complete before production data/credentials traverse these connections.

### ARCH-001 — Critical business stores default to process memory

- **Type:** Confirmed architectural/reliability risk with tenant-data integrity implications.
- **Evidence:** `IntakeService`, `OutboxService`, `ApprovalService`, `ReviewService`, `ExtractionService`, `OcrService`, `SearchService`, `ExportService`, `ReportService`, `NotificationService`, and others declare memory store defaults. `server.ts` and `worker.ts` do not visibly set all production service modes before handling work; tests explicitly configure modes. API and worker are separate processes.
- **Scenario:** API writes document metadata/outbox state to memory while file bytes are stored elsewhere; worker cannot see API process memory. Restart or multiple API replicas lose or diverge from process-local workflow state.
- **Impact:** Lost jobs, orphaned files, inconsistent approval/review state, duplicate or missing processing, and incorrect operational records.
- **Remediation:** Explicitly initialize all service persistence modes from validated deployment configuration; fail startup if production selects memory. Use durable DB/outbox as source of truth; add readiness checks for required dependencies and schema version.
- **Regression tests:** Production-profile integration test uploads, processes via separate worker, restarts both processes, verifies document/approval/outbox state survives, and exercises two API replicas.
- **Priority:** P1; release-blocking until runtime store wiring is demonstrated.

### CFG-001 — Production database configuration and migration path are incompatible

- **Type:** Confirmed deployment configuration defect.
- **Evidence:** `docker-compose.prod.example.yml` supplies `DATABASE_URL`; `backend/src/config/env.config.ts` reads discrete DB host/port/user/password/database values; `backend/src/database/postgres.client.ts` builds connection from those values. `backend/src/database/migrations/migrate.ts` explicitly rejects targets other than port 5434 and `docunexa_sandbox`. Production Compose has no migration step.
- **Scenario:** Compose starts API with DB URL it does not consume; client falls back to default localhost/port values. Even if app connectivity is fixed, checked-in migration runner refuses the production DB target.
- **Impact:** Service cannot reliably become ready or deploy a compatible schema; risks emergency manual schema changes and outages.
- **Remediation:** Align supported connection configuration with the runtime client (parse URL or provide explicit variables); add a controlled production migration workflow with backups, approval, version checks and rollback strategy; keep sandbox guard separate from production migration entry point.
- **Regression tests:** Compose configuration validation plus production-profile container test confirms DB target host/name, readiness, migration ordering and schema compatibility without touching production.
- **Priority:** P1; release-blocking.

### CFG-002 — Dependency and deployment CI jobs are not effective release gates

- **Type:** Confirmed DevSecOps control gap.
- **Evidence:** Root `.gitlab-ci.yml` runs `npm audit --audit-level=high || true`, so known high/critical findings do not fail the job. The root staging deploy and rollback jobs contain `echo`/placeholder actions rather than deployment/rollback commands. GitHub workflow includes frontend/backend build/test jobs, but its iOS job reports missing scaffold as informational.
- **Impact:** Build may be labeled secure or deployed without enforcing dependency policy or actually deploying to staging; release evidence is misleading.
- **Remediation:** Remove unconditional `|| true` or use an approved exception allowlist with expiry/owner; configure SBOM and lockfile scanning; make deploy/rollback jobs invoke the approved release system and verify health/rollback outcomes.
- **Regression tests:** Pipeline policy test confirms critical/high advisories fail absent an active exception and deploy job performs a verifiable operation.
- **Priority:** P2; remediate before relying on CI as a production release control.

### Additional unconfirmed risks needing next-pass verification

These are deliberately not promoted to confirmed findings without exhaustive source/test evidence:

- **Object-level authorization:** Review all parameterized document IDs and tenant predicates, especially admin trace, exports, avatar, compare, citation verification, connector mappings and purge evidence.
- **SSRF:** Verify webhook/connector target URL restrictions, DNS rebinding defenses, private/link-local destination denial, redirect handling and egress controls.
- **Parser/process isolation:** Validate Tesseract/Poppler invocation, resource limits, timeouts, temporary-file cleanup, sandboxing and hostile document handling.
- **Upload resource exhaustion:** Multipart handling appears memory-buffered. Verify upload limits, concurrent request limits, parser decompression bombs and request timeouts under load.
- **Database failure semantics:** Several services suppress query errors or use in-memory fallback. Audit each auth, MFA, retention, idempotency, audit and purge call site for fail-open behavior.
- **Retention/legal-hold concurrency:** Verify transaction/locking prevents purge racing with hold placement/release and that all object/derived stores are covered.
- **Audit integrity:** Verify HMAC key use, append-only enforcement, event completeness, redaction and key rotation; a signature column is not proof of immutability.
- **Dependencies/container:** No live dependency vulnerability scan or image scan was performed. Review package-lock findings, base-image patching, container user, capabilities, secrets and S3 permissions.

## 11. Test results and evidence limitations

### Command executed

```text
Working directory: document_intelligence_platform-main/backend
Command: npm test -- --runInBand src/services/auth.service.spec.ts src/services/security-containment.spec.ts
Environment: local Windows workspace; Jest test environment (`node`); existing installed dependencies
Result: PASS — 2 suites passed, 23 tests passed, 0 snapshots; Jest reported 66.527 seconds
```

The focused tests cover password/auth service behavior, forged/mock JWT rejection, claim validation, deactivation/session revocation, and other containment checks. They **do not** establish security of the public OTP request/verify controller path described in SEC-001, production configuration, real SMTP, real PostgreSQL, multiple replicas, or live worker integration. Passing these tests is not evidence that the vulnerable flow is safe.

The `runTests` helper initially reported “No tests found” for supplied paths; the package’s own Jest command was then used successfully. No other test, build, lint, coverage, dependency audit, secret scan, load test, browser E2E, migration, integration, container build, or penetration test was executed. Prior report test totals are historical claims and are not repeated as verified outcomes here.

### Test coverage gaps to close

1. Production-mode authentication integration tests for OTP, seeded users, MFA, DB outage, refresh replay and session revocation.
2. Cross-tenant BOLA tests for every ID-bearing controller, including direct repository queries and background jobs.
3. Full workflow test with PostgreSQL/Redis/object storage/ClamAV and separate API/worker processes.
4. Concurrent upload, duplicate/idempotency, approval, hold/purge and outbox delivery/retry tests.
5. Negative tests for malformed files, oversized/decompression-bomb documents, malware scanner outage, parser timeout and external-provider failure.
6. Dependency, secret, container, SAST and DAST checks as enforced gates; record exact versions, outputs and exceptions.

## 12. Performance, resilience, and operational readiness

| Area | Evidence | Assessment / required proof |
|---|---|---|
| API health/readiness | `/health/live`, `/health/ready`, metrics handlers and middleware exist | Runtime readiness, dependency checks and alert thresholds not tested. |
| Queue behavior | BullMQ retry/backoff, worker concurrency, outbox poller, DLQ routes exist | Need outage, duplicate, worker restart and poison-message tests; outbox completion/retry must be durable. |
| Scaling | Compose has a worker service; NFR describes autoscaling and 4-worker throughput | No Kubernetes HPA/worker scaling manifest found; no current benchmark output reviewed. |
| Upload/OCR limits | App has file limits and OCR page/time options | In-memory buffering and CPU/memory-bound document parsing require load and adversarial-file tests. |
| Storage/backup | S3-compatible/local/memory adapters and sandbox MinIO exist | Production IAM, encryption, versioning, backup and restore evidence unavailable. |
| Observability | Logger, correlation IDs, metrics, trace/admin routes exist | Confirmed incident evidence, PII redaction, retention, alert routing and live dashboards not verified. |
| Deployment | Production Compose example and CI Docker build jobs exist | DB config/migration mismatch; staging deploy placeholder; no cloud release evidence. |
| Recovery | Audit documents claim local backup/restore rehearsals | No command output or restore execution independently verified in this pass. |
| Compliance | Retention, legal hold, audit and masking features exist in code/schema | No SOC2/HIPAA/GDPR certification or operational control evidence established. |

## 13. Prioritized remediation roadmap and release gates

### P0 — block all production authentication exposure

1. Disable/remove OTP login until the flow has a secure approved design.
2. Remove OTP from responses and remove fixed codes from production-capable code.
3. Prohibit unknown-email account creation and requester-controlled role/tenant assignment.
4. Enforce MFA and existing active account checks on every token-issuing path.
5. Add production-mode negative tests and review/invalidate any tokens potentially created by the affected flow.

**Exit gate:** unauthenticated OTP/account-provisioning tests fail closed; no token issued without approved account proof; independent code review confirms all login/token paths.

### P1 — durable auth and business workflow

1. Remove test identities from production module initialization and make authentication/session state fail closed on DB errors.
2. Explicitly configure durable store mode for every service in API and worker startup; reject memory stores in production.
3. Repair production database connection variable handling and define a production-safe migration process.
4. Add cross-process persistence tests for upload → outbox → OCR → extraction → review/approval, including restarts and multiple replicas.
5. Establish tenant isolation at the database layer (RLS or documented equivalent with tested, enforced session context); inventory every tenant-scoped query.

**Exit gate:** successful staging deployment with real PostgreSQL/Redis/object store/scanner, durable workflow after restart, negative tenant tests, schema version verification and no production fallback to memory.

### P2 — secure transport and delivery controls

1. Enforce TLS and certificate validation for SMTP and PostgreSQL.
2. Make dependency audits blocking (or governed exceptions), add image/SBOM scanning, and remove placeholder release actions.
3. Verify webhook/connector SSRF protections, upload memory limits, parser isolation, rate-limit distribution and retention/purge concurrency.
4. Run dependency/security scan against lockfiles and produce an actionable, versioned exception register.

**Exit gate:** CI gates are enforced and auditable; invalid certificates are rejected; SSRF/upload/purge negative tests pass.

### P3 — baseline reconciliation and operational assurance

1. Resolve FR ID conflicts and publish a single approved BRD/PRD traceability matrix.
2. Correct README/architecture claims for Angular version, iOS status, JWT/cookie design, RLS, API count and test totals.
3. Run and archive load/performance, backup/restore, accessibility, operational DR, and stakeholder UAT evidence.

**Exit gate:** owners approve requirement baseline; target SLA measurements and restore rehearsals have signed evidence; unresolved feature gaps have owners and dates.

## 14. Retest plan

After remediation, repeat the following in an isolated staging environment with synthetic data only:

1. **Authentication:** route-level tests for OTP secrecy, fixed-code rejection, unknown accounts, role/tenant immutability, MFA enforcement, DB outage, refresh rotation/replay and session revocation.
2. **Authorization:** role × endpoint × object matrix; cross-tenant ID substitutions for all document, export, QA, trace, profile, connector and retention endpoints; test platform-operator restrictions.
3. **Durable pipeline:** upload via API and email, process with separate workers, restart components, induce Redis/PostgreSQL/S3/ClamAV outages, verify retries/DLQ and idempotency.
4. **Business invariants:** approval SoD and thresholds, optimistic concurrency, version immutability, citation-to-page verification, legal-hold/purge race tests.
5. **Data protection:** inspect logs/traces/error bodies for tokens, OTPs, PII and storage credentials; verify TLS certificates, S3 policy, encryption/versioning and deletion evidence.
6. **Static/supply chain:** clean install from lockfiles, build/typecheck/lint, blocking dependency audit, secret scan, SAST, container scan and SBOM review.
7. **Operational acceptance:** API/worker throughput and P95/P99 tests against NFR targets; multi-worker scaling; backup restore and failover measuring RTO/RPO; accessibility review; business UAT.

Record command, tool/version, environment, dataset provenance, exact result, limitations, owner, and evidence artifact for each gate. Do not use production data or run destructive checks against production.

## 15. Final release-readiness statement

**Current assessment: NOT READY FOR PRODUCTION.** The confirmed P0 OTP authentication bypass alone blocks release. Test identity fallback and unconfigured durable stores are additional release blockers. Production database connectivity/migration configuration is not demonstrated; CI does not enforce dependency audit results or perform actual staging deployment. Core product capabilities are present, but runtime integration, security guarantees, compliance assertions, scalability and recovery targets require evidence before they can be marked compliant.

No fixes were applied. This report is an initial audit ledger and should be followed by a bounded second pass on object-level authorization, webhook/connector SSRF, parser isolation, every fail-open database fallback, and retention/purge transaction invariants.


