# PHASE 2 — COMPLETE DATABASE & PERSISTENCE AUDIT REPORT

**Target Platform:** DocuNexa PostgreSQL & Storage Infrastructure  
**Engine:** PostgreSQL 16.x with `pgvector` Extension (Port 5434 / Database: `docunexa_sandbox`)  
**Secondary Store:** MongoDB 7.x (`derivedStoreMode` in `mongo.client.ts`)  
**Location:** `document_intelligence_platform-main/backend/src/database`  
**Audit Date:** 2026-10-16  
**Auditor Roles:** Principal Database Architect, Senior DevOps Engineer & Security Auditor  
**Audit Status:** COMPLETE (Sprint 0C Deliverable)

---

## 1. Executive Summary

An in-depth schema, migration, and persistence audit was conducted across the DocuNexa platform. The database architecture is designed for high-security multi-tenant enterprise document intelligence, utilizing PostgreSQL 16 with the `pgvector` extension for semantic embeddings and an immutable transactional outbox for event-driven asynchronous processing.

A comprehensive inventory of all **34 migration SQL files** spanning **26 sequential schema versions** was completed. Rollback scripts exist for all modern migrations (versions 019 through 026). Migration runner preflight guards in [`migrate.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/database/migrations/migrate.ts) strictly prevent accidental execution against production databases (protecting port 5432 and legacy port 5433).

However, an acute discrepancy exists between schema capabilities and runtime execution: while the PostgreSQL schema is fully designed with multi-tenant isolation on all 26 schema versions, **15 core backend services run in in-memory mode by default** (`storeMode = 'memory'`), completely bypassing the database unless explicitly configured.

---

## 2. Migration Inventory & Schema Evolution

The database migrations are organized chronologically in `src/database/migrations/` and tracked via the `schema_migrations` ledger table.

| Version | Migration File Name | Rollback Counterpart | Primary Tables & Objectives | Idempotency & Safety |
| :---: | :--- | :--- | :--- | :---: |
| **001** | `001_initial_schema.sql` | *None* | `tenants`, `users`, `audit_logs`. Core multi-tenant foundation. | Safe (DDL transaction) |
| **002** | `002_identity_and_sessions.sql` | *None* | `auth_sessions`. Refresh token hashing, family IDs, IP/UA tracking. | Safe |
| **003** | `003_rate_limit_entries.sql` | *None* | `rate_limit_entries`. Sliding-window counter store. | Safe |
| **004** | `004_document_types_templates_policies.sql` | *None* | `document_types`, `document_templates`, `extraction_schemas`, `validation_policies`. | Safe |
| **005** | `005_document_intake_and_quarantine.sql` | *None* | `documents`, `quarantine_records`. SHA256 deduplication, MIME validation. | Safe |
| **006** | `006_ocr_geometry_and_pages.sql` | *None* | `document_pages`, `ocr_tokens`, `bounding_boxes`. Geometry coordinates (x, y, w, h). | Safe |
| **007** | `007_classification_and_field_extraction.sql` | *None* | `document_classifications`, `extracted_fields`. Confidence scoring, source versioning. | Safe |
| **008** | `008_review_workbench_and_audit.sql` | *None* | `review_queue`, `review_assignments`, `field_corrections`. HITL triage states. | Safe |
| **009** | `009_approvals_sod_and_erp_publishing.sql` | *None* | `approval_requests`, `approval_steps`. Segregation of Duties (SoD), ERP export queue. | Safe |
| **010** | `010_semantic_search_and_version_compare.sql` | *None* | `document_embeddings` (pgvector 1536 dim), `version_comparisons`, `diff_clauses`. | Requires `vector` extension |
| **011** | `011_transactional_outbox_events.sql` | *None* | `outbox_events`. Transactional outbox pattern for guaranteed messaging. | Safe |
| **012** | `012_grounded_qa_traces_and_citations.sql` | *None* | `qa_conversations`, `qa_citations`. Evidence-grounded conversational traces. | Safe |
| **013** | `013_notifications_reports_exports_webhooks.sql` | *None* | `notifications`, `report_jobs`, `export_jobs`, `webhook_subscriptions`. | Safe |
| **014** | `014_retention_legal_hold_and_secure_purge.sql` | *None* | `retention_schedules`, `legal_holds`, `purge_cases`. Cryptographic seal verification. | Safe |
| **015** | `015_performance_and_search_indexes.sql` | *None* | Composite B-tree indexes, HNSW vector index on embeddings, tenant partition keys. | Safe |
| **016** | `016_security_and_roles.sql` | *None* | `role_permissions`, `pii_masking_rules`. Enterprise RBAC matrix. | Safe |
| **017** | `017_storage_and_purge_tracking.sql` | *None* | `storage_objects`, `purge_verification_ledger`. Object storage manifest. | Safe |
| **018** | `018_retry_tracking.sql` | *None* | `processing_attempts`, `dead_letter_queue`. Failure backoff telemetry. | Safe |
| **019** | `019_user_invitations_mfa_versioning.sql` | `..._rollback.sql` | `user_invitations`, MFA columns on `users` (`mfa_secret_enc`, `mfa_recovery_hashes`). | Fully Reversible |
| **020** | `020_mongodb_derived_summaries_email_intake.sql` | `..._rollback.sql` | `derived_summaries_sync`, `email_inbox_sources`. Hybrid MongoDB state tracking. | Fully Reversible |
| **021** | `021_fix_outbox_event_types_constraint.sql` | `..._rollback.sql` | Expands `outbox_events` check constraint to include new Sprint 11 event types. | Fully Reversible |
| **022** | `022_hardening_idempotency_notifications_correlation.sql` | `..._rollback.sql` | Unique idempotency indices, `correlation_id` foreign trace columns. | Fully Reversible |
| **023** | `023_review_edits_and_accuracy.sql` | `..._rollback.sql` | `review_edit_metrics`. Real-time extraction accuracy calculations. | Fully Reversible |
| **024** | `024_bounding_box_evidence_and_tasks.sql` | `..._rollback.sql` | `tasks`, `task_comments`, `task_assignees`. Collaboration task engine. | Fully Reversible |
| **025** | `025_tasks_compatibility_views.sql` | `..._rollback.sql` | SQL compatibility views for legacy task schemas. | Fully Reversible |
| **026** | `026_user_profile_enhancements.sql` | `..._rollback.sql` | `avatar_url`, `theme_preference`, `timezone`, `session_history`. | Fully Reversible |

---

## 3. Database Security & Tenant Isolation Model

### 3.1 Strict Row-Level Multi-Tenancy
- Every primary business table (`documents`, `review_queue`, `approval_requests`, `tasks`, `extracted_fields`, `audit_logs`, `outbox_events`) contains a mandatory foreign key or indexed column: `tenant_id VARCHAR(64) NOT NULL`.
- Foreign keys ensure that documents and related entities cannot reference entities belonging to a different tenant.
- All query patterns in repositories (e.g., [`derived-data.repository.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/database/derived-data.repository.ts)) include explicit `WHERE tenant_id = $1` filters.

### 3.2 Transaction Boundaries & Outbox Pattern
The platform implements a guaranteed-delivery Transactional Outbox pattern ([`011_transactional_outbox_events.sql`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/database/migrations/011_transactional_outbox_events.sql)):
- State mutations (e.g., document upload, review approval, task creation) write their business record and an `outbox_events` row within the same SQL transaction (`BEGIN ... COMMIT`).
- The background `OutboxService.startWorker()` polls unprocessed outbox rows (`status = 'PENDING'`), dispatches events to message brokers or webhook endpoints, and updates the status to `'PUBLISHED'` with monotonic timestamps.

### 3.3 Cryptographic Integrity
In migration `014` and `017`, legal hold purges compute a deterministic cryptographic seal (`SHA-256` hash of document ID, tenant ID, purge timestamp, and actor ID) written to the append-only `purge_verification_ledger`, ensuring tamper-evident compliance auditability.

---

## 4. The In-Memory Persistence Dilemma (`DEF-002`)

### 4.1 Diagnosis
The codebase was designed with a dual persistence architecture to support fast in-memory unit testing without spinning up PostgreSQL:
```typescript
// Pattern found in 15 domain services:
private static storeMode: 'memory' | 'database' = 'memory';
static setStoreMode(mode: 'memory' | 'database'): void {
  this.storeMode = mode;
}
```

### 4.2 The Flaw
The static variable `storeMode` defaults to `'memory'`.
While unit tests (`*.spec.ts`) frequently call `Service.setStoreMode('memory')`, the runtime server entrypoint [`src/server.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/server.ts) establishes the PostgreSQL connection pool but **never calls `setStoreMode('database')` on any service**.

### 4.3 Operational Impact
1. When DocuNexa runs in development or production via `npm start`, all document intake metadata, extracted fields, review approvals, tasks, and notifications are held in Node.js process memory.
2. PostgreSQL tables remain empty or receive only peripheral session records.
3. Upon any container restart, OS reboot, or uncaught exception, **all user data is irretrievably lost**.

### 4.4 Recommended Remediation
In `src/server.ts`, immediately following `validateDatabaseConnection()`, add a centralized persistence initialization routine:
```typescript
const persistentServices = [
  IntakeService, ReviewService, ApprovalService, OcrService,
  ClassificationService, ExtractionService, CompareService,
  SearchService, QaService, ReportService, OutboxService,
  NotificationService, WebhookService, ExportService, ConnectorService
];
persistentServices.forEach(s => s.setStoreMode('database'));
```
Alternatively, configure the default value of `storeMode` to read from environment variable `STORAGE_STORE_MODE || 'database'`.
