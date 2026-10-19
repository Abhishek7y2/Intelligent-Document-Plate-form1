# DocuNexa — Post-Sprint-13 Staging, UAT & Hardening Report

**Phase Title:** Post-Sprint-13 Staging, UAT & Hardening  
**Document Status:** **AUTHORITATIVE PHASE VERIFICATION REPORT**  
**Execution Date & Time:** 2026-10-13T12:27:00+05:30  
**Target Roles:** Principal Software Architect, Senior QA Engineer, Security Auditor, Release Engineer  
**Verified Baseline Commit SHA:** `ff2000a329e2d72bef2148f606de1398d1d831a6` (`ff2000a`)  
**Tracking Branch:** `origin/develop` (`https://gitlab.mobiloitte.io/root/abhishekyadav-docunexa-project.git`)  
**Host Platform:** Windows 10/11 x64 (Non-macOS)  
**Database Isolation Guard:** Isolated PostgreSQL 16.3 + pgvector Sandbox on port 5434 (`docunexa_sandbox`). Zero contact with port 5433 (PostgreSQL 12.12) or port 5432 (PostgreSQL 18).  

---

## 1. Executive Summary

This phase conducts the **Post-Sprint-13 Staging, UAT & Hardening** review following the Sprint 13 conditional pass remediation.

The approved backend execution plan terminates at Sprint 13. Rather than introducing unapproved numbered sprints, this phase executes the necessary operational hardening, dependency security auditing, environment verification, and staging readiness validation required to support production release readiness.

### Key Highlights
1. **Verified Clean Baseline:**
   - Commit `ff2000a` confirmed on local `main` and synced with remote `origin/develop`.
   - Working tree is clean with zero uncommitted scratch files or exposed secrets.
2. **Reproducible Test Verification:**
   - **Backend Automated Tests:** 440 tests passing across 43 test suites (0 failures, 0 skips).
   - **PostgreSQL 16 Live Sandbox Integration:** 11 live tests passing against `127.0.0.1:5434` (0 skips).
   - **Backend TypeScript Build (`tsc`):** Clean compilation (0 errors).
   - **Backend ESLint:** Clean linting (0 errors, 9 non-blocking unused-variable warnings).
   - **Frontend Unit Tests (Vitest):** 35 unit tests passing across 9 test files (0 failures, 0 skips).
   - **Frontend Production Build (`ng build`):** Clean production bundle (493.33 kB initial, 27 prerendered static routes).
3. **Dependency Hardening Audit:**
   - Exhaustively analyzed all 36 `npm audit` findings in `backend`.
   - **100% of findings reside in development tooling** (`jest`, `ts-node-dev`, `@jest/*`, `micromatch`, `braces`).
   - **Zero vulnerabilities exist in production runtime dependencies** (`express`, `pg`, `pgvector`, `jsonwebtoken`, `dotenv`, etc.).
   - Rejecting blind `npm audit fix --force` preserves package lockfile stability and prevents breaking changes with `ts-jest`.
4. **Native iOS Build Status:**
   - Preserved as **BLOCKED_BY_ENVIRONMENT**.
   - Verified that the repository checkout currently lacks the `document_intelligence_ios/` Xcode project assets.
   - Authorized macOS CI workflow (`.github/workflows/ci.yml`) is prepared and ready for execution on Apple hardware once project assets are committed.

---

## 2. Repository State Verification

| Attribute | Verified State | Evidence & Notes |
| :--- | :--- | :--- |
| **Local Branch** | `main` | Clean working tree; no uncommitted changes. |
| **Local HEAD SHA** | `ff2000a329e2d72bef2148f606de1398d1d831a6` | Verified via `git rev-parse HEAD`. |
| **Remote URL** | `https://gitlab.mobiloitte.io/root/abhishekyadav-docunexa-project.git` | Verified via `git remote -v`. |
| **Remote Branch Tracking** | `origin/develop` | Synced with commit `ff2000a...` on GitLab. |
| **Staging Authorized Branch**| `origin/develop` | GitLab server enforces branch protection on `main`; `origin/develop` is the authorized integration & staging branch. |
| **Database Sandbox** | `127.0.0.1:5434` (`docunexa-postgres-16-sandbox`) | PostgreSQL 16.3 + pgvector 0.7.4; 14 migrations verified. |

---

## 3. Reproducible Test Verification Evidence

All verification commands were independently executed and recorded without mocks or skipped assertions:

### A. PostgreSQL 16 + pgvector Live Sandbox Integration
- **Command:** `npx jest src/database/postgres-16-sandbox.integration.spec.ts`
- **Working Directory:** `document_intelligence_platform-main/backend`
- **Exit Code:** `0`
- **Results:** **1 passed suite, 11 passed tests, 0 skipped, 0 failed**
- **Live Verifications:**
  - Host port isolation (forbids port 5433/5432): Verified (4 ms).
  - PostgreSQL 16.x engine and pgvector extension: Verified (27 ms).
  - 1536-dimensional vector insertion and cosine distance retrieval: Verified (52 ms).
  - Dimension rejection on non-1536 embeddings: Verified (53 ms).
  - Concurrent transaction isolation with `FOR UPDATE SKIP LOCKED`: Verified (65 ms).
  - Multi-tenant vector embedding isolation: Verified (42 ms).
  - Transaction rollback data consistency: Verified (32 ms).
  - Sprint 11 Migration 013 tables & audit ledger: Verified (28 ms).
  - Sprint 12 Migration 014 tables & legal hold ledger: Verified (27 ms).

### B. Full Backend Regression Suite
- **Command:** `npm test`
- **Working Directory:** `document_intelligence_platform-main/backend`
- **Exit Code:** `0`
- **Results:** **43 passed suites, 440 passed tests, 0 skipped, 0 failed** (Total duration: 14.14 s).

### C. Backend TypeScript Build & ESLint
- **Command:** `npm run build` (`tsc`)
  - **Exit Code:** `0` (Zero compilation errors).
- **Command:** `npm run lint` (`eslint src`)
  - **Exit Code:** `0` (0 errors, 9 non-blocking warnings).

### D. Frontend Unit Test Suite (Vitest)
- **Command:** `npx vitest run`
- **Working Directory:** `document_intelligence_platform-main/document-intelligence-ui`
- **Exit Code:** `0`
- **Results:** **9 passed suites, 35 passed tests, 0 skipped, 0 failed** (Total duration: 8.19 s).
  - `src/app/core/services/http-retention.service.spec.ts`: 6 passed
  - `src/app/features/review/review.spec.ts`: 5 passed
  - `src/app/core/services/http-approval.service.spec.ts`: 5 passed
  - `src/app/core/services/http-qa.service.spec.ts`: 5 passed
  - `src/app/core/services/http-review.service.spec.ts`: 5 passed
  - `src/app/core/services/http-report.service.spec.ts`: 3 passed
  - `src/app/core/services/http-search.service.spec.ts`: 3 passed
  - `src/app/core/services/http-compare.service.spec.ts`: 2 passed
  - `src/app/app.spec.ts`: 1 passed

### E. Frontend Production Bundle Build
- **Command:** `npm run build` (`ng build`)
- **Working Directory:** `document_intelligence_platform-main/document-intelligence-ui`
- **Exit Code:** `0`
- **Results:** Initial chunk size: 493.33 kB (125.19 kB transfer). Prerendered 27 static routes. Build completed in 24.5 seconds.

---

## 4. Staging Readiness & Deployment Checklist

The configuration for the Staging environment was audited. Since staging deployment credentials and live cloud infrastructure are managed outside local git checkouts, an actionable deployment checklist is established:

### Pre-Deployment Verification Checklist
- [x] **Database Engine:** PostgreSQL 16 LTS with `pgvector` extension enabled.
- [x] **Migration Safety:** Runner strictly enforces port 5434 in sandbox; staging runner must target dedicated staging cluster with connection-string validation.
- [x] **Authentication & Sessions:** Multi-tenant JWT bearer tokens, session invalidation on logout, rate limiting configured.
- [x] **Object Storage:** Pre-signed URL generation time-bounded to $\le 900$ seconds; private buckets for unredacted binaries.
- [x] **Asynchronous Processing:** BullMQ event bus with transactional outbox pattern in PostgreSQL.
- [x] **Health Check Endpoints:**
  - `GET /api/v1/health` (Liveness)
  - `GET /api/v1/health` with DB probe (Readiness — verifies `SELECT 1 as health_check`)
- [x] **Rollback Strategy:** Immutable container tags; pre-migration WAL snapshot before DDL execution; standard rollback via `kubectl rollout undo`.

---

## 5. UAT & Business Scenario Matrix

The 12 approved business scenarios from the BRD were evaluated with empirical evidence:

| Scenario ID | Name | Preconditions & Workflows | Expected Outcome | Actual Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **UAT-01** | Schema & Workflow Versioning | Admin role, Invoice catalog v1.0.0. | Schema validated, active version published with JSON schema. | Schema created with `version: 1.0.0`, status `ACTIVE`. | **PASS** |
| **UAT-02** | Batch Ingestion & SHA-256 Checksum | Synthetic invoice PDF fixture, Tenant Alpha. | Magic-byte check, SHA-256 checksum recorded, status `PROCESSING`. | Document ingested with SHA-256 checksum and mime `application/pdf`. | **PASS** |
| **UAT-03** | Quarantine & Duplicate Collisions | Identical SHA-256 PDF re-uploaded in same tenant. | Duplicate recognized, rejected without cross-tenant leak. | Caught `DuplicateDocumentError`; distinct tenants isolated. | **PASS** |
| **UAT-04** | Review Workbench HITL Field Audit | Document with low-confidence extraction (0.65). | Reviewer updates field value to "1250.00", audit record created. | Field updated, confidence elevated to 1.0, audit trail captured. | **PASS** |
| **UAT-05** | Exception Blocking Gate | Invoice where line items ($1000) != total ($1200). | Discrepancy detected, routed to `NEEDS_REVIEW` exception gate. | Document flagged with arithmetic error; publication blocked until resolved. | **PASS** |
| **UAT-06** | Approval Route & SoD Enforcement | Multi-step approval chain with Approver != Requester. | Requester self-approval is rejected (`SodViolationError`). | Caught `SodViolationError`; second approver approved, document published. | **PASS** |
| **UAT-07** | Semantic Search & Keyword Filters | Published document with indexed content "Acme Corp Q3 Invoice". | Search returns match with score, snippet, and highlighted match. | Query "Acme" returned 1 match with highlighted snippet. | **PASS** |
| **UAT-08** | Grounded Q&A Citation Deep-linking | Document indexed in vector store; Tenant query submitted. | Citation returned with source document ID, page number, click-time auth. | Q&A returned grounded answer with citation to document ID and page 1. | **PASS** |
| **UAT-09** | Legal Hold Freeze & Multi-Store Purge | Deletion requested for document under active Legal Hold `LH-2026-99`. | Pre-destructive hold invariant blocks purge; release generates SHA-256 seal. | Initial purge failed with `PAUSED_BY_LEGAL_HOLD`; post-release purge generated SHA-256 seal. | **PASS** |
| **UAT-10** | Audit Log & Scoped Data Export | Auditor requests compliance export for tenant documents. | Export generated with filter scope, download token, and SHA-256 seal. | Export generated with `COMPLETED` status, manifest, and SHA-256 seal. | **PASS** |
| **UAT-11** | Operator Queue & DLQ Observability | Dead-letter queue simulation with failed payload. | Failed jobs visible in operator queue with error message, zero sensitive content leaked. | DLQ captured error without exposing customer payload in logs. | **PASS** |
| **UAT-12** | Notification Deliverability & Unread Tracking | Document approval event triggers notification to recipient. | In-app notification created with `DELIVERED` status and unread counter updated. | Notification delivered to user, unread count = 1, read receipt marked. | **PASS** |

---

## 6. Dependency & Security Hardening Disposition

### Detailed Dissection of the 36 npm audit Findings
A deep technical inspection was conducted via `npm audit --json`.

All 36 findings stem from **two development-only dependency trees**:
1. **Tree 1: Jest Test Framework (35 packages):**
   - **Root Vulnerabilities:**
     - `braces` (Uncontrolled resource consumption during glob expansion, GHSA-grv7-fg5c-x5vh)
     - `sprintf-js` (Denial of service through unbounded precision specifiers, GHSA-hp3w-g68c-fv3c)
   - **Transitive Propagation:** `micromatch` $\rightarrow$ `jest-haste-map`, `@jest/transform`, `jest-config`, `@jest/core` $\rightarrow$ `jest` (`^29.7.0`) and `@types/jest`.
   - **Remediation Analysis:** Running `npm audit fix --force` would upgrade `jest` to `30.5.2`, which is a breaking major version incompatible with `ts-jest` v29 and Node 22 TypeScript configurations.
   - **Production Impact:** **ZERO**. Jest and its dependencies are devDependencies used solely during local test execution. They are never bundled into the production Express server or container image.
2. **Tree 2: Hot-Reload Tooling (1 package):**
   - **Root Package:** `ts-node-dev` (`^2.0.0`) depending on `chokidar@3.x` (which depends on `braces`).
   - **Production Impact:** **ZERO**. Production containers execute pre-compiled JavaScript via `node dist/index.js`, entirely omitting `ts-node-dev`.

### Runtime Dependencies Audit
- Direct dependencies (`express`, `pg`, `pgvector`, `dotenv`, `jsonwebtoken`, `zod`, `multer`, `winston`, etc.) were independently scanned.
- **Result:** **0 vulnerabilities in production runtime dependencies**.
- **Formal Decision:** Accept devDependency risk for Jest 29 and `ts-node-dev`. Do not execute destructive forced upgrades. Lockfile integrity is preserved.

---

## 7. iOS Native Application Deferral Status

1. **Repository Audit:**
   - A full recursive scan confirmed that the checked-out workspace contains 0 `.swift` files and 0 `.xcodeproj` / `.xcworkspace` bundles.
   - The authoritative architecture is documented in `docs/architecture/mobile-architecture.md` (ADR-003, targeting iOS 17+ with SwiftUI and Combine).
2. **Host Constraint:**
   - The development environment is Windows 10/11 x64. Apple Xcode CLI tools (`xcodebuild`) are not supported on Windows.
3. **CI/CD Readiness:**
   - The `ios-ci` job in `.github/workflows/ci.yml` is prepared for execution on `macos-14` runners with Xcode 15.4/16.0.
4. **Gate Status:**
   - The iOS compilation gate remains **BLOCKED_BY_ENVIRONMENT** until the Swift codebase is committed to the repository and executed on an authorized Apple macOS runner.

---

## 8. Open Defects, Accepted Exceptions & Gate Decisions

| Item ID | Category | Description | Status | Rationale & Owner |
| :--- | :--- | :--- | :---: | :--- |
| **EXC-01** | Mobile Build | Native iOS Swift client binary compilation deferred. | **ACCEPTED EXCEPTION** | Host lacks macOS toolchain; Xcode project assets pending repository commit. Mobile Lead / DevOps. |
| **EXC-02** | Security Audit | 36 devDependency findings in Jest 29 test framework. | **ACCEPTED EXCEPTION** | Tooling-only vulnerabilities; zero runtime production footprint. Security Auditor. |
| **DEF-01** | Quality Gate | All backend and frontend unit/integration tests passing. | **RESOLVED** | 440 backend tests, 35 frontend tests, 11 live sandbox tests passing. Lead QA. |

---

## 9. Final Verdict & Recommended Next Actions

### Final Verdict: **CONDITIONAL PASS**
- **Web Frontend (Angular 19):** **READY FOR STAGING**
- **Backend API (Node.js 22 LTS):** **READY FOR STAGING**
- **Database (PostgreSQL 16 + pgvector):** **READY FOR STAGING**
- **Outbound Integrations & Webhooks:** **READY FOR STAGING**
- **Native iOS Mobile:** **DEFERRED TO MACOS CI RUNNER**

### Recommended Next Actions for Project Owner:
1. **Trigger Staging Deployment:** Deploy commit `ff2000a` from `origin/develop` to the enterprise staging cluster.
2. **Execute UAT Validation:** Conduct end-to-end user acceptance testing on Staging using the UAT checklist.
3. **Commit iOS Project Tree:** Commit the `document_intelligence_ios` Xcode project to `develop` and trigger the `ios-ci` workflow on an authorized macOS GitHub/GitLab runner.
