# DocuNexa — Sprint 3 Database Compatibility Audit & Sandbox Readiness

**Audit Date:** 2026-10-09  
**Auditor:** Principal Backend Engineer & PostgreSQL Database Architect  
**Target Environment:** Local PostgreSQL 12.12 on `127.0.0.1:5433`  
**Target Database:** `docunexa`  
**Authenticated User:** `postgres`  
**Audit Scope:** Schema Compatibility & Sandbox Provisioning Readiness for Sprint 1–3 Migrations (001–004)  
**Gate Verdict:** **BLOCKED — database version, provisioning, or authorization prerequisite missing**

---

## 1. Executive Summary

A comprehensive, non-destructive audit and sandbox readiness evaluation was performed on the DocuNexa repository and database environment.

### Key Conclusions:
1. **Engine Version Discrepancy:** The approved DocuNexa architecture specification ([`docs/ARCHITECTURE_DECISIONS.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/ARCHITECTURE_DECISIONS.md) - **ADR-002**) mandates **PostgreSQL 16 Enterprise with `pgvector`** as the single primary relational engine. The active local host database runs **PostgreSQL 12.12** on port 5433. No authorized PostgreSQL 16 instance is available on the host (ports 5432 and 5434 are closed).
2. **Infrastructure Verification:** Docker and Podman are not installed on the host system. WSL 2 is installed but has no active Linux distribution.
3. **Pre-Existing Enterprise Schema in `docunexa`:** The active `docunexa` database contains **49 public tables** created under an enterprise relational architecture with **UUID primary keys** and foreign key references across all entities (`tenants.id`, `users.id`, `workspaces.id`, `documents.id`, `document_types.id`). Active application data is present (2 tenants, 4 users, 4 roles, 8 permissions, 2 workspaces).
4. **Architectural Incompatibility with Prototype Migrations:** Sprint 1–3 prototype migrations (`001_initial_schema.sql` through `004_document_types_templates_policies.sql`) define an early development schema utilizing `VARCHAR(64)` primary keys (`tenant_id`, `user_id`, `document_id`, `type_id`). Running these migrations against `docunexa` would fail with fatal foreign key and index errors.
5. **Sandbox Status & Non-Destructive Protection:** The proposed sandbox database `docunexa_sandbox` **does not exist** on the cluster. In strict adherence to engineering safety rules (*"Do not create or overwrite any database automatically"*), sandbox creation was halted pending explicit DBA provisioning and version alignment.
6. **Operational Verification:** Existing backend code compiles cleanly (`tsc`), passes ESLint (`0 errors`), passes all 65 Jest unit tests, connects successfully to PostgreSQL on port 5433, and passes live HTTP readiness probes (`/api/v1/ready`).

---

## 2. Step 1 — PostgreSQL Version Architecture Verification

### 2.1 Architecture Baseline Requirement
A review of project architecture documentation reveals:
- **`docs/ARCHITECTURE_DECISIONS.md` (ADR-002):**
  > *"Approved Decision: PostgreSQL 16 is the single, primary enterprise database engine... supports native JSONB querying, cryptographic extensions (pgcrypto), vector search (pgvector for semantic search in Sprint 4), and connection pooling."*
- **`docs/architecture/database-architecture.md`:**
  > *"Core Engine: PostgreSQL 16.4 Enterprise Edition with pgvector extension."*
- **`docs/SPRINT_0_ARCHITECTURE_BASELINE.md`:**
  > *"Baseline Stack: Node.js 22 LTS (TypeScript v5) | PostgreSQL 16 (pgvector) | Angular 19 | Native iOS (Swift)"*

**Conclusion:** **PostgreSQL 16 is mandatory for the production architectural baseline.**

### 2.2 Host Environment Engine Probing
A port and socket scan of `127.0.0.1` revealed:
- **Port 5432:** `CLOSED` (`false`)
- **Port 5433:** `OPEN` (`true`) — Running `PostgreSQL 12.12, compiled by Visual C++ build 1914, 64-bit`
- **Port 5434:** `CLOSED` (`false`) — Confirmed available for PostgreSQL 16 sandbox provisioning.

### 2.3 Version Compatibility & Feature Gap Analysis
While PostgreSQL 12.12 supports standard SQL, `pgcrypto`, and `uuid-ossp`, it exhibits critical capability gaps compared to the mandated PostgreSQL 16 baseline:
1. **`pgvector` Extension:** Not available/packaged in PostgreSQL 12.12 on Windows. This represents a hard blocker for Sprint 4 vector embeddings and semantic retrieval.
2. **Enhanced JSONB Subscripting & Operators:** PostgreSQL 14+ native JSON subscripting (`fields['key']`) is unavailable in PostgreSQL 12.
3. **Logical Replication & Outbox Performance:** PostgreSQL 16 introduces major enhancements to concurrent logical decoding and vacuum efficiency required for the high-volume transactional outbox pattern.

---

## 3. Step 2 — Sandbox Readiness & Database Inventory

### 3.1 Cluster Database Audit
Executing `SELECT datname FROM pg_database WHERE datistemplate = false;` against port 5433 confirmed:
- `postgres` (System maintenance database)
- `docunexa` (Active primary database containing 49 tables)

### 3.2 Sandbox Verification
- **Target Sandbox Name:** `docunexa_sandbox`
- **Current Status:** **DOES NOT EXIST** (`SELECT EXISTS(...)` returned `false`).
- **Enforcement of Safeguard:** Under the instruction:
  > *"Confirm administrator authorization. Confirm that docunexa_sandbox does not already exist. Do not create or overwrite any database automatically. If authorization or the correct PostgreSQL version is unavailable, stop and provide the exact prerequisite."*
  Database creation was **not** performed.

### 3.3 Active Public Tables in `docunexa` (49 Total — Preserved 100%)
```
ai_provenance, approval_decisions, approval_route_steps, approval_routes, approval_steps,
audit_logs, clarification_requests, classification_results, deletion_cases, document_search_index,
document_type_configs, document_types, documents, evidence, exceptions,
extracted_fields, extraction_runs, files, integration_configs, legal_holds,
malware_scan_results, notification_preferences, notifications, ocr_results, outbox_events,
permissions, processing_jobs, processing_runs, publication_records, purge_manifests,
qa_citations, qa_messages, qa_sessions, retention_policies, review_comments,
review_edits, review_history, revoked_tokens, role_permissions, roles,
source_versions, tenants, user_roles, users, validation_results,
version_comparisons, webhook_deliveries, webhook_subscriptions, workspaces
```

---

## 4. Step 3 — Configuration Precedence and Loading

The DocuNexa environment loader ([`src/config/env.config.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/config/env.config.ts)) was audited for database parameter resolution:

```typescript
  postgres: {
    host: process.env['DB_HOST'] || process.env['POSTGRES_HOST'] || '127.0.0.1',
    port: parseInt(process.env['DB_PORT'] || process.env['POSTGRES_PORT'] || '5433', 10),
    user: process.env['DB_USERNAME'] || process.env['POSTGRES_USER'] || 'postgres',
    pass: process.env['DB_PASSWORD'] || process.env['POSTGRES_PASSWORD'] || '',
    database: process.env['DB_DATABASE'] || process.env['POSTGRES_DB'] || 'docunexa',
    ssl: (process.env['DB_SSL'] || process.env['POSTGRES_SSL']) === 'true',
    maxPool: parseInt(process.env['DB_MAX_POOL'] || process.env['POSTGRES_MAX_POOL'] || '20', 10),
  }
```

### Precedence Rules Verified:
1. `DB_DATABASE` takes precedence over `POSTGRES_DB`.
2. When configuring the sandbox on port 5434, setting both `DB_DATABASE=docunexa_sandbox` and `POSTGRES_DB=docunexa_sandbox` in `backend/.env` guarantees unambiguous runtime targeting.

---

## 5. Step 4 — Migration Compatibility Findings

| Migration File in Repo | Intent | Conflict with Existing `docunexa` DB | Status |
|---|---|---|---|
| `001_initial_schema.sql` | Baseline tenants, users, documents | `tenants`, `users`, `documents` already exist with UUID PKs. `document_extracted_fields` attempts `REFERENCES documents(document_id)` which does not exist (`id` is UUID). | **INCOMPATIBLE** |
| `002_identity_and_sessions.sql` | Memberships & auth sessions | Targets `REFERENCES users(user_id)` and `REFERENCES tenants(tenant_id)`. Neither column exists in the database. | **INCOMPATIBLE** |
| `003_rate_limit_entries.sql` | Distributed rate limiter | Standalone table `rate_limit_entries` (`key VARCHAR(255) PK`). | **COMPATIBLE (Standalone)** |
| `004_document_types_templates_policies.sql` | Document types, templates, policies | Table `document_types` already exists with `(id uuid, tenant_id uuid, name varchar, current_schema_version int)`. Missing `code`, `status`, `active_version`. `extraction_templates` fails on `REFERENCES document_types(type_id)`. | **INCOMPATIBLE** |

---

## 6. Step 5 — Verification Results: Build, Lint & Automated Tests

All automated checks were executed and verified against the backend repository:

| Verification Stage | Command | Exit Code | Verified Evidence |
|---|---|---|---|
| **TypeScript Compilation** | `npm run build` (`tsc`) | `0` | Compiles cleanly to `dist/` with 0 compiler diagnostics. |
| **ESLint Static Analysis** | `npm run lint` (`eslint src`) | `0` | Code passes ESLint (0 errors, 8 non-blocking warnings). |
| **Automated Test Suite** | `npm test -- --runInBand` | `0` | **65 passed, 0 failed across 8 suites** (Jest 29.7.0). |
| **Live Database Connectivity** | `GET /api/v1/health` | `HTTP 200` | `{ "status": "UP", "service": "docunexa-backend" }` |
| **Live Database Readiness** | `GET /api/v1/ready` | `HTTP 200` | `{ "status": "UP", "dependencies": { "postgres": "UP" } }` |

### Distinction of Test Types:
- **Unit & Logic Tests (65/65 PASS):** Tests regex ReDoS defense (`safeRegexMatch`), policy evaluation engine, JWT generation/validation, RFC 7807 problem details, rate limiting logic, and tenant isolation fencing.
- **Mocked Persistence Tests (PASS):** Persistence failure and rollback tests using mocked PostgreSQL client instances verifying fail-closed behavior (HTTP 503 upon database disconnection).
- **Read-Only Schema Inspection (PASS):** Direct execution of introspection queries against PostgreSQL 12.12 on port 5433 verifying engine version, 49 tables, constraints, and data presence.
- **Live Migration Execution (BLOCKED):** Paused pending authorized provisioning of `docunexa_sandbox` on PostgreSQL 16.

---

## 7. Sprint 3 Gate Verdict & Missing Prerequisites

### Verdict:
**BLOCKED — database version, provisioning, or authorization prerequisite missing**

### Detailed Justification:
1. **Database Version Prerequisite Missing:** Project architecture ADR-002 mandates PostgreSQL 16 with `pgvector`. The host currently provides PostgreSQL 12.12 without `pgvector`.
2. **Infrastructure Prerequisite Missing:** Docker is not installed on the host, preventing automated startup of the pinned `pgvector/pgvector:0.7.4-pg16` container.
3. **Sandbox Provisioning Prerequisite Missing:** `docunexa_sandbox` does not exist on the database cluster, and agent self-creation was prohibited.
4. **Provisioning Plan Documented:** Complete DevOps instructions and pinned Docker compose specs are provided in [`docs/POSTGRESQL_16_PGVECTOR_PROVISIONING_PLAN.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/POSTGRESQL_16_PGVECTOR_PROVISIONING_PLAN.md).
