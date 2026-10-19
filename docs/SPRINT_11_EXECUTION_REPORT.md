# DocuNexa Sprint 11 — Execution Report: Notifications, Reports, Exports & Webhooks

**Version:** 1.0 — Final Verification & Acceptance  
**Date:** 13 October 2026  
**Roles:** Senior Software Architect, Node.js Backend Engineer, Angular Engineer, PostgreSQL Engineer, Security Engineer, Integration Engineer, DevOps Engineer, Lead QA Engineer  
**Gate Verdict:** **PASS** (Migration 013 applied to PostgreSQL 16 container on port 5434; all 6 Sprint 11 database tables verified; versioned notifications with delivery state machine and bounded retries implemented; operational reports and telemetry KPIs reconciled server-side; secure asynchronous export pipeline with PII/financial data masking, SHA-256 seal computation, and short-lived authorized download tokens verified; outbound webhooks signed with HMAC-SHA256, 5-minute freshness headers, replay protection, and dead-letter recovery verified; connector sandbox contracts with formal mapping sign-off and posting approval gate verified; Angular 19 UI integrated with real `HttpReportService` and tested in Vitest; all 406 backend tests, 10 live sandbox tests, and 23 frontend service tests passing; production TypeScript and Angular builds succeeded with zero errors; no subsequent sprints started).

---

## 1. Executive Summary

Sprint 11 deliverables have been designed, implemented, and rigorously verified according to the approved `DocuNexa_Backend_PRD_Sprint_Execution_Plan.docx` and the DocuNexa BRD (FR-016, FR-017, FR-018, FR-019, INT-004, SEC-007, SEC-008, SEC-009, SEC-010).

The sprint transforms operational governance into production-grade, persistent, auditable workflows across five key pillars:
1. **Notifications & Delivery Tracking:** In-app and email delivery engine, versioned templates for 6 core events, delivery state machine (`QUEUED`, `DELIVERED`, `RETRYING`, `FAILED`), bounded retries with backoff, and user preference management.
2. **Operational Reports & Dashboard KPIs:** Reconciled telemetry APIs (`/api/v1/reports/governance`, `/api/v1/reports/kpis`), multi-tab aggregated metrics (Executive, Ingestion, AI SLA, Governance, Exceptions), tenant/role authorization, and date range filtering.
3. **Secure Asynchronous Exports:** Server-authorized export queue (`POST /api/v1/exports/request`), stable identifiers (`EXP-xxx`), filter snapshotting, PII and financial-field masking, SHA-256 seal computation, short-lived download tokens, and download-time re-authorization.
4. **Signed Outbound Webhooks:** Webhook subscription management, canonical payload construction, HMAC-SHA256 signature headers (`x-docunexa-signature`, `x-docunexa-timestamp`), 5-minute freshness checks, replay protection, attempt history, and dead-letter recovery.
5. **Connector Sandbox & Mapping Sign-Off:** ERP/CLM connector contracts (SAP BAPI, NetSuite REST, Generic REST), source-to-target field mapping, formal sign-off workflow, and strict enforcement of the invariant: **no external posting without document approval AND signed-off mapping**.

---

## 2. Sprint 11 Traceability Matrix

| Requirement ID | Scope Area | Architectural Component | API Endpoint / Service / Worker | Verification Test Suite | Final Status |
|---|---|---|---|---|:---:|
| **S11-NOTIF-01** | Versioned Notification Templates | `NotificationService` | 6 templates: receipt, exception, assignment, returned, approval, expiry | `notification.service.spec.ts` | **PASS** |
| **S11-NOTIF-02** | Delivery State Machine & Retries | `NotificationService` | `QUEUED` -> `DELIVERED` / `RETRYING` / `FAILED` with backoff | `notification.service.spec.ts` | **PASS** |
| **S11-NOTIF-03** | User Preferences & In-App / Email Routing | `NotificationController` | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/preferences` | `notification.service.spec.ts` | **PASS** |
| **S11-REP-01** | Operational Telemetry & KPI Engine | `ReportService` | `GET /api/v1/reports/governance`, `GET /api/v1/reports/kpis` | `report.service.spec.ts` | **PASS** |
| **S11-REP-02** | Multi-Tab Reconciled Aggregations | `ReportService` | Executive, Ingestion, AI SLA, Governance, Exceptions | `report.service.spec.ts` | **PASS** |
| **S11-REP-03** | Tenant & Role Authorization on Metrics | `ReportController` | RBAC gated via `REPORT_GENERATE`, tenant-isolated | `report.service.spec.ts` | **PASS** |
| **S11-EXP-01** | Asynchronous Export Job Queue | `ExportService` | `POST /api/v1/exports/request`, `GET /api/v1/exports/:id` | `export.service.spec.ts` | **PASS** |
| **S11-EXP-02** | PII & Financial Field Masking | `ExportService` | Automated masking of accounts, tax IDs, sensitive keys | `export.service.spec.ts` | **PASS** |
| **S11-EXP-03** | Authorized Short-Lived Download Tokens | `ExportController` | `GET /api/v1/exports/:id/download` with token re-check & expiry | `export.service.spec.ts` | **PASS** |
| **S11-WHK-01** | Outbound Webhook Subscriptions | `WebhookService` | `POST /api/v1/webhooks/subscriptions`, `GET`, `DELETE` | `webhook.service.spec.ts` | **PASS** |
| **S11-WHK-02** | HMAC-SHA256 Payload Signing & Freshness | `WebhookService` | `x-docunexa-signature`, `x-docunexa-timestamp`, timing-safe check | `webhook.service.spec.ts` | **PASS** |
| **S11-WHK-03** | Replay Protection & Dead-Letter Recovery | `WebhookService` | `POST /api/v1/webhooks/deliveries/:id/retry`, attempt logging | `webhook.service.spec.ts` | **PASS** |
| **S11-CONN-01** | Connector Sandbox Contracts | `ConnectorService` | SAP BAPI, NetSuite REST, Generic JSON connector adapters | `connector.service.spec.ts` | **PASS** |
| **S11-CONN-02** | Mapping Review & Formal Sign-Off Gate | `ConnectorService` | `POST /api/v1/connectors/mappings/:id/sign-off` | `connector.service.spec.ts` | **PASS** |
| **S11-CONN-03** | Approval & Sign-Off Gating Invariant | `ConnectorService` | Reject posting if document unapproved or mapping unsigned | `connector.service.spec.ts` | **PASS** |
| **S11-UI-01** | Angular 19 Reports & Export Integration | `reports.ts`, `http-report.service.ts` | Live reports telemetry, async export trigger & CSV download | `http-report.service.spec.ts` | **PASS** |
| **S11-UI-02** | Angular 19 Notification Drawer Wiring | `notification.service.ts` | Real-time notification synchronization & mark read | Vitest UI suite | **PASS** |
| **S11-UI-03** | Angular 19 Integrations Drawer Wiring | `admin-integrations.ts` | Webhook subscriptions and ERP connector status | Vitest UI suite | **PASS** |

---

## 3. Database Schema & Migration 013 Evidence

Migration `013_notifications_reports_exports_webhooks.sql` was verified against live PostgreSQL 16 (`127.0.0.1:5434 / docunexa_sandbox`):

```sql
-- Migration 013 Tables:
1. notifications (id, tenant_id, user_id, type, category, title, message, severity, target_url, read, delivery_channel, delivery_status, delivery_attempts, created_at, read_at)
2. notification_preferences (id, tenant_id, user_id, notification_type, email_enabled, in_app_enabled, updated_at)
3. export_jobs (id, tenant_id, user_id, report_type, format, status, filters_snapshot, mask_pii, total_records, file_path, file_size_bytes, sha256_hash, download_token, token_expires_at, expires_at, download_count, created_at, completed_at)
4. webhook_subscriptions (id, tenant_id, name, target_url, secret_hash, secret_preview, subscribed_events, is_active, created_by, created_at, updated_at)
5. webhook_deliveries (id, subscription_id, tenant_id, event_id, event_type, payload_snapshot, signature_header, timestamp_header, attempt_number, status, http_status_code, response_body_snippet, error_message, duration_ms, created_at, completed_at)
6. connector_mappings (id, tenant_id, connector_type, document_type, version, field_mappings, sandbox_mode, is_signed_off, signed_off_by, signed_off_at, created_at, updated_at)
```

**Live Verification Result:**
- `schema_migrations` record `013_notifications_reports_exports_webhooks.sql` confirmed.
- All 6 tables verified in `information_schema.tables` on port 5434.

---

## 4. Technical Implementation Details

### 4.1 Versioned Notifications & Delivery State Machine
- **Templates:** 6 predefined templates with mustache-style variable substitution (`document_receipt`, `processing_failure`, `review_assignment`, `document_returned`, `document_approved`, `retention_expiry`).
- **Channel Routing:** Dynamically respects user preferences (`email_enabled`, `in_app_enabled`). If an email channel fails, delivery status transitions to `RETRYING` with exponential backoff up to 3 attempts, after which it marks `FAILED`. In-app notifications persist with unread tracking.
- **Sensitive Data Safety:** Notification messages format human-readable summaries and metadata without disclosing raw document content, secrets, or tokens.

### 4.2 Operational Reports & Reconciled Telemetry
- **Multi-Tab Architecture:**
  - Executive Overview: Total processed volume, Straight-Through-Processing (STP) rate, SLA compliance score, volume trends.
  - Ingestion & Pipeline: Channels breakdown (Email, SFTP, REST API, Scan Folder) with error rates.
  - AI Quality & Review SLA: Confidence bracket distributions, OCR quality weekly trends, turnaround aging buckets (`< 4h`, `4-12h`, `12-24h`, `> 24h`).
  - Governance & Audit Trail: Immutable event log with actor, role, action, resource, and SHA-256 seals.
  - Exceptions & Retention: Quarantined malware events, review rejects, and retention purge schedules.
- **Strict Authorization:** Enforces `REPORT_GENERATE` permission and tenant scoping on all database queries.

### 4.3 Secure Asynchronous Exports
- **Queue Pipeline:** Clients initiate exports via `POST /api/v1/exports/request` returning HTTP 202 Accepted with stable ID `EXP-xxx`. Generation runs asynchronously.
- **PII & Financial Masking:** Automatic redaction of account numbers (`ACCT-***-4421`), tax IDs (`TAX-***-992`), and sensitive fields when `maskPii: true` (default).
- **Cryptographic Integrity:** Computes SHA-256 seal (`sha256_hash`) over generated CSV content.
- **Short-Lived Download Tokens:** Issues 15-minute download tokens (`DLT-xxx`). Download endpoint `GET /api/v1/exports/:id/download` verifies tenant ownership, token match, and token expiry before streaming bytes with `X-Artifact-Checksum` headers.

### 4.4 Signed Outbound Webhooks
- **Payload Signing:** HMAC-SHA256 signature generated over canonical format `${timestamp}.${JSON.stringify(payload)}` using subscription secret.
- **Security Headers:** Dispatches `x-docunexa-signature` and `x-docunexa-timestamp`.
- **Replay Protection:** Rejects payloads where timestamp drifts by more than 300 seconds (5 minutes). Uses constant-time `crypto.timingSafeEqual` for signature verification.
- **Dead-Letter & Operator Retry:** Failed deliveries log HTTP status and response snippet. Endpoint `POST /api/v1/webhooks/deliveries/:id/retry` enables authorized operator re-triggering.

### 4.5 Connector Sandbox & Mapping Review Gate
- **Connector Adapters:** Unified interface supporting SAP BAPI, NetSuite REST, and Generic JSON endpoints in sandbox/simulated mode.
- **Mapping Review Workflow:** Formal sign-off endpoint `POST /api/v1/connectors/mappings/:id/sign-off` records reviewer ID, timestamp, and version locks.
- **Hard Approval Invariant:** `dispatchToConnector` strictly validates:
  1. Document status must be `APPROVED` (rejects `PENDING_REVIEW`, `DRAFT`, `REJECTED`).
  2. Connector mapping must have `is_signed_off: true` (rejects unsigned drafts).

---

## 5. Verification & Test Suite Results

| Test Suite / Command | Target / Scope | Result | Passed / Total |
|---|---|:---:|:---:|
| `notification.service.spec.ts` | Notification dispatch, templates, retries, preferences | **PASS** | 7 / 7 |
| `report.service.spec.ts` | Governance telemetry, KPIs, date range filters, tenant isolation | **PASS** | 5 / 5 |
| `export.service.spec.ts` | Async export queue, PII masking, SHA-256 seal, token expiry | **PASS** | 8 / 8 |
| `webhook.service.spec.ts` | HMAC signing, timestamp freshness, replay rejection, retries | **PASS** | 7 / 7 |
| `connector.service.spec.ts` | Connector mapping sign-off, approval gating, sandbox dispatch | **PASS** | 9 / 9 |
| `postgres-16-sandbox.integration.spec.ts` | Live PostgreSQL 16 + pgvector sandbox on port 5434 (Migration 013) | **PASS** | 10 / 10 |
| `Full Backend Jest Regression` | All backend unit, integration, and security test suites | **PASS** | **406 / 406** |
| `Frontend Vitest Suite` | Angular 19 services (`HttpReportService`, `HttpQaService`, etc.) | **PASS** | **23 / 23** |
| `Backend TypeScript Build` | `tsc` compilation | **PASS** | 0 Errors |
| `Backend Linter` | `npm run lint` (ESLint) | **PASS** | 0 Errors |
| `Frontend Production Build` | `ng build` (Angular 19 SSR + 27 static routes) | **PASS** | 0 Errors |

---

## 6. Out of Scope Confirmation

Sprint 12 and Sprint 13 have strictly **not** been started. All work completed in this phase is strictly limited to Sprint 11 requirements and dependencies.
