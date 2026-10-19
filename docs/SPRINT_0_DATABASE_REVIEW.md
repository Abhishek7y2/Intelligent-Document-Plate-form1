# DocuNexa Sprint 0 Database Review & Schema Readiness

**Module:** Task S0-04 PostgreSQL Schema & Migration Readiness  
**Target Engine:** PostgreSQL 16  

---

## 1. Schema Inventory & Entity Verification

| Entity Name | Primary Key | Foreign Keys | Key Indexes | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `tenants` | `tenant_id` (VARCHAR) | None | `tenant_id` | Multi-tenant organization boundaries. |
| `users` | `user_id` (VARCHAR) | `tenant_id` ➔ `tenants` | `email` (UNIQUE) | System users & RBAC roles. |
| `documents` | `document_id` (VARCHAR) | `tenant_id`, `assigned_to` | `sha256_hash`, `sla_status` | Core document workflow lifecycle. |
| `document_extracted_fields` | `field_id` (UUID) | `document_id` | `document_id`, `field_key` | Extracted fields & human corrections. |
| `audit_trail_events` | `event_id` (UUID) | `tenant_id`, `document_id` | `tenant_id`, `created_at` | Cryptographically sealed HMAC audit events. |
| `telemetry_hourly_metrics` | `metric_id` (UUID) | `tenant_id` | `tenant_id`, `metric_timestamp` | Hourly aggregate KPI telemetry. |

---

## 2. Migration Execution Guidelines
Execute baseline migrations using the DDL script in [`docs/DATABASE_SCHEMA_POSTGRES.sql`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/DATABASE_SCHEMA_POSTGRES.sql).
