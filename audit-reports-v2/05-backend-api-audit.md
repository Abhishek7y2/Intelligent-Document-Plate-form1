# DocNexa — Backend Services & API Audit Report (Reconciled Baseline v2.0)

**Document ID:** AUDIT-REP-05-V2  
**Audit Date:** 2026-10-13T18:41:00+05:30  
**Evaluator:** Principal Backend Architect & API Security Specialist  
**Framework:** Node.js, Express, TypeScript, PostgreSQL 16 (`pg`), Redis / In-Memory Queue  
**Base API Endpoint:** `http://localhost:8080/api/v1`  

---

## 1. Backend Architecture Overview

The backend is organized as a clean, modular Express service written in strict TypeScript.
- **Controllers:** Handle HTTP request validation, extract tenant context, delegate to domain services, and return RFC 7807 Problem Details on errors.
- **Middleware:** `authenticateJwt`, `requirePermission`, `enforceTenantIsolation`, `loginRateLimiter`, and global `errorHandler`.
- **Database Access:** `dbPool` provides pooled client connections to PostgreSQL 16 (running on sandbox port 5434), utilizing parameterized queries with SQL injection immunity.
- **Asynchronous Reliability:** Employs a Transactional Outbox Worker (`OutboxService`) that polls `outbox_events` every 10,000ms to guarantee at-least-once delivery for webhook events and document processing tasks.

---

## 2. API Endpoint Inventory & Compliance

| Endpoint Group | Route | Method | Controller & Service | Permissions Required | Security & Business Rules Enforced |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **System Health** | `/health` | GET | `health.controller.ts` | Public | Liveness probe returning process uptime and timestamp. |
| | `/ready` | GET | `health.controller.ts` | Public | Readiness probe checking PostgreSQL and Redis connectivity. |
| **Authentication** | `/auth/login` | POST | `auth.controller.ts` | Public (Rate Limited) | Issues JWT (8h) & refresh token (7d). Triggers background login alert email via SMTP. |
| | `/auth/request-otp` | POST | `auth.controller.ts` | Public (Rate Limited) | Generates 6-digit OTP; dispatches email via SMTP (Nodemailer); 5-min expiry. |
| | `/auth/verify-otp` | POST | `auth.controller.ts` | Public (Rate Limited) | Validates OTP code; limits incorrect attempts to 5; logs in user. |
| | `/auth/smtp-status` | GET | `auth.controller.ts` | Public | Reports SMTP host, port, security, and configuration status. |
| | `/auth/refresh` | POST | `auth.controller.ts` | Authenticated | Atomic refresh token rotation with concurrency grace period and replay revocation. |
| | `/auth/logout` | POST | `auth.controller.ts` | Authenticated | Revokes refresh token session family. |
| | `/auth/me` | GET | `auth.controller.ts` | Authenticated | Returns current authenticated user record, tenant, and permission matrix. |
| **Document Intake** | `/documents/upload` | POST | `intake.controller.ts` | `DOC_UPLOAD` | Multipart upload (up to 50MB); MIME validation; ClamAV virus scan; SHA-256 duplicate detection. |
| | `/documents` | GET | `document.controller.ts` | `DOC_VIEW` | Tenant-isolated document list with pagination, status filters, and sorting. |
| | `/documents/:id` | GET | `document.controller.ts` | `DOC_VIEW` | Detailed document metadata, source version, and file download URL. |
| **OCR & Geometry** | `/ocr/:id` | POST | `ocr.controller.ts` | `DOC_EDIT` | Triggers OCR layout parser; returns spatial polygon coordinates. |
| | `/ocr/:id/geometry` | GET | `ocr.controller.ts` | `DOC_VIEW` | Returns page-level token boxes with coordinate polygons `[x, y, w, h]`. |
| **Classification** | `/classification/:id` | GET/POST | `classification.controller.ts` | `DOC_VIEW` / `DOC_EDIT` | Classifies document type with calibrated confidence; allows manual override. |
| **Extraction** | `/extraction/:id` | GET/POST | `extraction.controller.ts` | `DOC_VIEW` / `DOC_EDIT` | Extracts key-value entities and tabular line items linked to source pages. |
| **Review & HITL** | `/review/queue` | GET | `review.controller.ts` | `DOC_VERIFY` | Returns documents awaiting review, ordered by SLA priority. |
| | `/review/:id` | GET | `review.controller.ts` | `DOC_VERIFY` | Returns review workbench model with extracted fields and validation exceptions. |
| | `/review/:id/fields/:key`| POST | `review.controller.ts` | `DOC_EDIT` | Persists reviewer field correction with optimistic locking and audit trail. |
| | `/review/:id/decision` | POST | `review.controller.ts` | `DOC_VERIFY` | Submits review decision (`APPROVED`, `CHANGES_REQUESTED`, `REJECTED`). |
| **Approvals & SoD** | `/approvals/queue` | GET | `approval.controller.ts` | `DOC_APPROVE` | Returns approval requests filtered by tenant and authorization thresholds. |
| | `/approvals/:id/decide` | POST | `approval.controller.ts` | `DOC_APPROVE` | **Separation of Duties:** Enforces that uploader/reviewer cannot approve. Logs immutable decision. |
| **Version Comparison**| `/compare` | POST | `compare.controller.ts` | `COMPARE_VIEW` | Computes clause additions, deletions, modifications, and financial variance between versions. |
| **Semantic Search** | `/search` | GET/POST | `search.controller.ts` | `DOC_VIEW` | Executes hybrid search combining SQL full-text metadata and pgvector embeddings. |
| **Grounded Q&A (FR-019)** | `/qa/query` | POST | `qa.controller.ts` | `QA_QUERY` | Answers natural language queries with verified citations; strict abstention policy (`ABSTAIN`). |
| | `/qa/citations/verify` | POST | `qa.controller.ts` | `QA_QUERY` | Verifies cited page and paragraph against source document coordinates. |
| **Reporting & Export**| `/reports/governance`| GET | `report.controller.ts` | `REPORT_GENERATE` | Returns volume, aging, exception counts, and accuracy benchmarks. |
| | `/reports/kpis` | GET | `report.controller.ts` | `REPORT_GENERATE` | Operational KPIs (accuracy, SLA adherence, review turnaround percentiles). |
| | `/exports/request` | POST | `export.controller.ts` | `REPORT_GENERATE` | Asynchronously generates CSV/JSON export packages with SHA-256 seal. |
| | `/exports/:id/download` | GET | `export.controller.ts` | `REPORT_GENERATE` | Gated download link with single-use expiring token. |
| **Retention & Purge** | `/retention/policies` | GET/POST | `retention.controller.ts` | `POLICY_MANAGE` | Enforces regulatory retention rules and expiration schedules. |
| | `/retention/holds` | POST | `retention.controller.ts` | `POLICY_MANAGE` | Places litigation legal holds, freezing expiration countdowns. |
| | `/retention/purge` | POST | `retention.controller.ts` | `ADMIN_ACCESS` | Executes cryptographic secure purge; blocks purges under active hold; seals audit ledger. |
| **Webhooks** | `/webhooks/subscriptions` | GET/POST | `webhook.controller.ts` | `ADMIN_ACCESS` | Manages webhook subscriptions with HMAC-SHA256 signature verification. |

---

## 3. Integration Verification & Operational Notes

1. **Grounded Q&A (FR-019, AI-006):** Verified end-to-end via `POST /api/v1/qa/query` and `POST /api/v1/qa/citations/verify`. The service strictly abstains (`ABSTAIN`) when evidence is ungrounded and immune to document-borne prompt injection attacks.
2. **Separation of Duties (FR-013, FR-014):** Tested and verified; attempts by uploader or reviewer to invoke `/approvals/:id/decide` result in HTTP 403 `SOD_VIOLATION`.
3. **SMTP Gateway Integration:** Production-ready `nodemailer` integration provides transactional email delivery, OTP dispatch, and asynchronous security login alerts.
