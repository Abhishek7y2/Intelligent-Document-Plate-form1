# DocuNexa Sprint 11 — Implementation Plan: Notifications, Reports, Exports & Webhooks

**Version:** 1.0 — Architecture & Execution Blueprint  
**Date:** 12 October 2026  
**Roles:** Senior Software Architect, Node.js Backend Engineer, Angular Engineer, PostgreSQL Engineer, Security Engineer, Integration Engineer, DevOps Engineer, Lead QA Engineer  
**Status:** Approved for Execution  

---

## 1. Scope Reconciliation & Governance Baseline

### 1.1 Scope Reconciliation Against Authoritative Plans
Before implementing code, the planned scope was reconciled against:
1. **`docs/BACKEND_SPRINT_ROADMAP.md` (Line 20):**  
   `- **Sprint 11 (Notifications & Reports):** Governance telemetry APIs, authorized signed CSV export download, HMAC webhooks.`
2. **`docs/BACKEND_PRD_AND_SPRINT_PLAN.md` (Section 2, Row S11):**  
   `| **S11** | **Notifications, Reports & Exports** | P1 | Telemetry KPIs, authorized signed CSV export download, webhook delivery with HMAC. |`
3. **`DocuNexa BRD`:**  
   Functional requirements for notifications (receipt, exceptions, review assignment, returned for changes, approvals, retention expiry), governance reporting (FR-023 KPIs, STP, SLAs), and enterprise integrations (FR-022 audit, external ERP connectors, outbound webhooks).

**Verdict:** The scope defined in the user request strictly aligns with all authoritative project documents. No conflict exists.

### 1.2 Five Pillars of Sprint 11:
1. **Notifications & Delivery Tracking:** In-app and email delivery engine, versioned templates for 6 core events, delivery state machine (`QUEUED`, `DELIVERED`, `RETRYING`, `FAILED`), bounded retries, and user preference management.
2. **Operational Reports & Dashboard KPIs:** Reconciled telemetry APIs (`/api/v1/reports/governance`, `/api/v1/reports/kpis`), multi-tab aggregated metrics (Executive, Ingestion, AI SLA, Governance, Exceptions), tenant/role authorization, and date range filtering.
3. **Secure Asynchronous Exports:** Server-authorized export queue (`POST /api/v1/exports/request`), stable identifiers (`EXP-xxx`), filter snapshotting, PII/financial data masking, SHA-256 seal computation, short-lived download tokens, and download-time re-authorization.
4. **Signed Outbound Webhooks:** Webhook subscription management, canonical payload construction, HMAC-SHA256 signature headers (`x-docunexa-signature`, `x-docunexa-timestamp`), 5-minute freshness checks, replay protection, attempt history, and dead-letter recovery.
5. **Connector Sandbox & Mapping Sign-Off:** ERP/CLM connector contracts (SAP BAPI, NetSuite REST, Generic REST), source-to-target field mapping, formal sign-off workflow, and strict enforcement of the invariant: **no external posting without document approval AND signed-off mapping**.

---

## 2. Sprint 11 Traceability Matrix

| Requirement ID | Scope Area | Architectural Component | API Endpoint / Service / Worker | Verification Test Suite |
|---|---|---|---|---|
| **S11-NOTIF-01** | Versioned Notification Templates | `notification.service.ts` | 6 templates: receipt, exception, assignment, returned, approval, expiry | `notification.service.spec.ts` |
| **S11-NOTIF-02** | Delivery State Machine & Retries | `notification.service.ts` | `QUEUED` -> `DELIVERED` / `RETRYING` / `FAILED` with backoff | `notification.service.spec.ts` |
| **S11-NOTIF-03** | User Preferences & In-App / Email Routing | `notification.controller.ts` | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/preferences` | `notification.controller.spec.ts` |
| **S11-REP-01** | Operational Telemetry & KPI Engine | `report.service.ts` | `GET /api/v1/reports/governance`, `GET /api/v1/reports/kpis` | `report.service.spec.ts` |
| **S11-REP-02** | Multi-Tab Reconciled Aggregations | `report.service.ts` | Executive, Ingestion, AI SLA, Governance, Exceptions | `report.service.spec.ts` |
| **S11-REP-03** | Tenant & Role Authorization on Metrics | `report.controller.ts` | RBAC gated via `REPORT_GENERATE`, tenant-isolated | `report.controller.spec.ts` |
| **S11-EXP-01** | Asynchronous Export Job Queue | `export.service.ts` | `POST /api/v1/exports/request`, `GET /api/v1/exports/:id` | `export.service.spec.ts` |
| **S11-EXP-02** | PII & Financial Field Masking | `export.service.ts` | Automated masking of accounts, tax IDs, sensitive keys | `export.service.spec.ts` |
| **S11-EXP-03** | Authorized Short-Lived Download Tokens | `export.controller.ts` | `GET /api/v1/exports/:id/download` with token re-check & expiry | `export.controller.spec.ts` |
| **S11-WHK-01** | Outbound Webhook Subscriptions | `webhook.service.ts` | `POST /api/v1/webhooks/subscriptions`, `GET`, `DELETE` | `webhook.service.spec.ts` |
| **S11-WHK-02** | HMAC-SHA256 Payload Signing & Freshness | `webhook.service.ts` | `x-docunexa-signature`, `x-docunexa-timestamp`, timing-safe check | `webhook.service.spec.ts` |
| **S11-WHK-03** | Replay Protection & Dead-Letter Recovery | `webhook.service.ts` | `POST /api/v1/webhooks/deliveries/:id/retry`, attempt logging | `webhook.service.spec.ts` |
| **S11-CONN-01** | Connector Sandbox Contracts | `connector.service.ts` | SAP BAPI, NetSuite REST, Generic JSON connector adapters | `connector.service.spec.ts` |
| **S11-CONN-02** | Mapping Review & Formal Sign-Off Gate | `connector.service.ts` | `POST /api/v1/connectors/mappings/:id/sign-off` | `connector.service.spec.ts` |
| **S11-CONN-03** | Approval & Sign-Off Gating Invariant | `connector.service.ts` | Reject posting if document unapproved or mapping unsigned | `connector.service.spec.ts` |
| **S11-UI-01** | Angular 19 Reports & Export Integration | `reports.ts`, `http-report.service.ts` | Live reports telemetry, async export trigger & CSV download | `http-report.service.spec.ts` |
| **S11-UI-02** | Angular 19 Notification Drawer Wiring | `notification.service.ts` | Replace mock notifications with backend API sync | Vitest UI suite |
| **S11-UI-03** | Angular 19 Integrations Drawer Wiring | `admin-integrations.ts` | Real webhook subscriptions and ERP connector status | Vitest UI suite |

---

## 3. Database Migration Architecture (Migration 013)

Migration file: `013_notifications_reports_exports_webhooks.sql`

```sql
-- 1. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    target_url VARCHAR(255),
    entity_id VARCHAR(64),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
    delivery_status VARCHAR(16) NOT NULL DEFAULT 'DELIVERED',
    delivery_attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id, read);

-- 2. Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(32) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, notification_type)
);

-- 3. Export Jobs
CREATE TABLE IF NOT EXISTS export_jobs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    report_type VARCHAR(64) NOT NULL,
    format VARCHAR(16) NOT NULL DEFAULT 'csv',
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    filters_snapshot JSONB NOT NULL DEFAULT '{}',
    mask_pii BOOLEAN NOT NULL DEFAULT TRUE,
    total_records INTEGER NOT NULL DEFAULT 0,
    file_path VARCHAR(255),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_hash VARCHAR(64),
    download_token VARCHAR(64),
    token_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant ON export_jobs(tenant_id, status);

-- 4. Outbound Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    target_url VARCHAR(512) NOT NULL,
    secret_hash VARCHAR(128) NOT NULL,
    secret_preview VARCHAR(16) NOT NULL,
    subscribed_events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhook_subscriptions(tenant_id, is_active);

-- 5. Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    subscription_id VARCHAR(64) NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_snapshot JSONB NOT NULL,
    signature_header VARCHAR(128) NOT NULL,
    timestamp_header VARCHAR(32) NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    http_status_code INTEGER,
    response_body_snippet TEXT,
    error_message TEXT,
    next_retry_at TIMESTAMPTZ,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant ON webhook_deliveries(tenant_id, status);

-- 6. Connector Mappings
CREATE TABLE IF NOT EXISTS connector_mappings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    connector_type VARCHAR(32) NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    field_mappings JSONB NOT NULL DEFAULT '[]',
    sandbox_mode BOOLEAN NOT NULL DEFAULT TRUE,
    is_signed_off BOOLEAN NOT NULL DEFAULT FALSE,
    signed_off_by VARCHAR(64),
    signed_off_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, connector_type, document_type, version)
);
```

---

## 4. Execution Sequence

1. **Database Migration:** Create and execute migration `013_notifications_reports_exports_webhooks.sql` on PostgreSQL 16 container (`127.0.0.1:5434 / docunexa_sandbox`).
2. **Backend Domain Models:** Create `notification.models.ts`, `report.models.ts`, `export.models.ts`, `webhook.models.ts`, and `connector.models.ts`.
3. **Backend Core Services:** Implement `NotificationService`, `ReportService`, `ExportService`, `WebhookService`, and `ConnectorService`.
4. **Backend Controllers & Routes:** Register endpoints under `/api/v1/notifications`, `/api/v1/reports`, `/api/v1/exports`, `/api/v1/webhooks`, `/api/v1/connectors`.
5. **Backend Unit & Security Test Suites:** Write and verify comprehensive test suites covering all 18 requirements.
6. **Frontend Angular 19 Services & Integration:** Build `HttpReportService`, wire `reports.ts`, `notification.service.ts`, and `admin-integrations.ts` to backend endpoints.
7. **Regression & Live Sandbox Verification:** Run full Jest suites, live sandbox integration test, Angular Vitest suites, backend/frontend builds, and linting.
8. **Final Reports:** Write `SPRINT_11_EXECUTION_REPORT.md` and `SPRINT_11_INDEPENDENT_VERIFICATION_REPORT.md`.
