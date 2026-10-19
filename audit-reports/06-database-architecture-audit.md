# DocuNexa — Database Architecture & Document Lifecycle Audit

**Document ID:** AUDIT-REP-06  
**Audit Date:** 2026-10-13T18:11:00+05:30  
**Evaluator:** Principal Database Architect & Data Governance Specialist  
**Primary Engine:** PostgreSQL 16.3 with `pgvector` Extension (HNSW Indexing)  
**Secondary Store:** MongoDB Unstructured Analysis Collection Specifications  
**Storage Architecture:** Local Sandbox Filesystem with S3-Compatible Object Storage Contract  

---

## 1. Database Architecture & Schema Evolution

The DocuNexa platform employs a hybrid persistence model:
1. **PostgreSQL 16 (Authoritative Transactional Core):** Stores tenants, users, roles, documents, source versions, structured extractions, approval workflows, audit trails, and vector embeddings.
2. **MongoDB (Derived Layout & Analysis):** Stores spatial bounding boxes, dense OCR polygon coordinates, candidate extractions, and raw Q&A conversation traces.
3. **Object Storage:** Retains immutable original binary files (PDF, TIFF, DOCX, PNG) and cryptographically sealed export bundles.

### Migration Inventory (Migrations 001 through 014)

The database schema is managed via 14 sequential migrations executed with transactional DDL safety:
- **`001_initial_schema.sql`:** Base tables: `tenants`, `users`, `documents`, `audit_events`.
- **`002_auth_sessions.sql`:** Session management, refresh token hashes, and family ID rotation.
- **`003_document_types.sql`:** Dynamic document types, taxonomies, and versioned extraction templates.
- **`004_document_pages_ocr.sql`:** Page geometry, layout metadata, and OCR token lists.
- **`005_extractions_fields.sql`:** Extracted key-value entities, field coordinates, confidence scores.
- **`006_review_tasks.sql`:** HITL review assignments, SLA due dates, reviewer correction history.
- **`007_approvals_sod.sql`:** Multi-tier approval routes, decision records, Separation of Duties constraints.
- **`008_pgvector_hnsw.sql`:** Vector embeddings table `document_chunks` using 1536-dimensional embeddings with HNSW indexing.
- **`009_comparisons.sql`:** Version diff results, clause additions/deletions, financial variance grids.
- **`010_qa_traces.sql`:** Conversational queries, response synthesis, citation coordinates, abstention flags.
- **`011_notifications.sql`:** In-app notification queues, delivery logs, user preference matrices.
- **`012_retention_holds.sql`:** Regulatory retention schedules, litigation legal holds, purge ledgers.
- **`013_outbox_events.sql`:** Transactional outbox table for resilient asynchronous event dispatch.
- **`014_webhooks_audit.sql`:** Webhook subscriptions, HMAC signatures, tamper-evident hash chaining.

---

## 2. Multi-Tenancy & Row-Level Security (RLS)

All tenant-scoped tables include a mandatory `tenant_id` foreign key referencing `tenants(tenant_id)`.
- **Row-Level Security (RLS):** Enabled across all primary entities (`documents`, `document_extractions`, `review_tasks`, `approval_requests`, `document_chunks`).
- **Context Injection:** Express middleware sets the current tenant context (`SET LOCAL app.current_tenant_id = $1`) on pooled database client connections prior to query execution.
- **Cross-Tenant Prevention:** Verified through negative tests—queries originating from Tenant A receive 0 rows when attempting to access Tenant B documents.

---

## 3. Complete Document Lifecycle State Machine

The document lifecycle adheres to the state machine specified in the BRD:

```
[ Upload ]
    │
    ▼
[ Received ] ──(Infected)──► [ Quarantined ]
    │ (Clean)
    ▼
[ Processing ] (OCR, Classification, Extraction, Math Rules)
    │
    ├─► Confidence >= 85% & No Rule Mismatch ──► [ Pending Approval ]
    │                                                    │
    └─► Confidence < 85% or Mismatch Flagged             │
              │                                          │
              ▼                                          ▼
      [ In Review ] ─────────(Reviewer Signs Off)────────┘
              │
              ▼
      [ Approved / Published ] ──► [ Superseded ] (When v+1 is uploaded)
              │
              ▼
      [ Retention Scheduled ] ──(Litigation)──► [ Legal Hold Active ] (Purge Paused)
              │ (Period Expired)                      │ (Hold Released)
              ▼                                       ▼
      [ Purge Eligible ] ─────────────────────────────┘
              │
              ▼
      [ Cryptographically Purged ] (Zero-fill overwrite & SHA-256 sealed ledger)
```

---

## 4. Asynchronous Queue & Transactional Outbox Pattern

To eliminate distributed dual-write inconsistencies, all state-changing operations write their business data and corresponding event payload within a single atomic database transaction:
```sql
BEGIN;
  UPDATE documents SET status = 'READY_FOR_REVIEW' WHERE document_id = $1;
  INSERT INTO outbox_events (event_id, event_type, payload, status)
  VALUES (gen_random_uuid(), 'DOCUMENT_REVIEW_READY', $2, 'PENDING');
COMMIT;
```
The `OutboxService` background daemon continuously polls and dispatches pending events with exponential backoff retries, ensuring guaranteed at-least-once delivery even during temporary network or worker outages.
