# DocuNexa — Master 8-Sprint Remediation & Implementation Guide

**Authoritative Roadmap for DocuNexa Hardening & Feature Completion**

Stack: Node.js 22 LTS (Express + TypeScript) | PostgreSQL 16 (`pgvector`) | MongoDB 7 | Redis 7 | MinIO / S3 | ClamAV | Angular 19 Standalone Components.

---

## Sprint Overview Matrix

| Sprint | Theme | Scope Summary | Current Status |
| :---: | :--- | :--- | :---: |
| **Sprint 1** | **Security Containment (P0)** | Mock JWT removal, 32-char secret enforcement, session revocation on request, user deactivation session cascade, tenant-scoped document get, migration 016 (tenant-scoped SHA256, canonical roles). | ✅ **Completed & Verified** |
| **Sprint 2** | **Storage + Malware Scanning** | S3-compatible adapter (AWS S3 + MinIO), StorageFactory (`s3`, `local`, `memory`), real purge in object storage with `purge_ledger` records, TCP ClamAV scanner with fail-closed policy, Docker compose additions. | ✅ **Completed & Verified** |
| **Sprint 3** | **Durable Queue + Retry Architecture** | BullMQ Redis queues (`ocr`, `extraction`, `webhook`), outbox poller with `FOR UPDATE SKIP LOCKED`, worker daemon (`src/worker.ts`), migration 017 (`retry_count`, `last_error`, `document_processing_attempts`), `POST /documents/:id/retry`. | ✅ **Completed & Verified** |
| **Sprint 4** | **Users, MFA & File Replacement** | User invitation flow (`POST /users/invite`, `POST /auth/accept-invite`, migration 019), TOTP MFA (`otplib`, `qrcode`, AES-256-GCM encrypted secret, 8 backup recovery codes), file replacement (`POST /documents/:id/replace`, `document_versions`, `source_version_id`). | ✅ **Completed & Verified** |
| **Sprint 5** | **MongoDB + AI Summaries + Email Intake** | MongoDB derived-data repository (`ocr_pages`, `extraction_runs`, `clause_diffs`, `qa_traces`, `evaluation_runs`), AI-007 document summary with verified quotes, IMAP email poller (`imapflow`, `mailparser`, `intake_mailboxes`). | ⏳ **Ready to Execute** |
| **Sprint 6** | **API Hardening + Reporting** | OpenAPI 3.1 (`swagger-ui-express`), Idempotency-Key middleware (`idempotency_keys`), role-based export masking, SSE real-time notifications (`/notifications/stream`), AsyncLocalStorage Correlation ID, reviewer-correction accuracy report. | ⏳ **Queued** |
| **Sprint 7** | **Frontend UI Gaps (Angular 19)** | Batch multi-file drag-and-drop with per-file progress, 409 duplicate dialog, Task management form, Admin invite dialog, Admin operations retry action, Review Workbench bounding-box canvas overlay. | ⏳ **Queued** |
| **Sprint 8** | **Quality, CI/CD, Load Testing & Ops** | Full CI/CD workflow (`.github/workflows/ci.yml`), k6 load testing (search & upload SLAs), PostgreSQL + Mongo + MinIO backup & restore drill scripts, golden-set extraction accuracy runner, UAT-08 to UAT-10. | ⏳ **Queued** |

---

## Execution Guidelines
1. Maintain existing codebase structure, TypeScript conventions, and service naming.
2. Ensure database IDs use `VARCHAR(64)` matching existing primary keys (`documents.id`, `tenants.id`, `users.id`).
3. Maintain zero test regressions: run `npx tsc --noEmit` and Jest test suites at the end of each sprint.
