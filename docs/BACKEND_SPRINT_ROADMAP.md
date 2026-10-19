# DocuNexa Backend Sprint Roadmap & Implementation Backlog

**Sprint Planning Horizon:** Sprint 0 to Sprint 13  
**Approved Baseline:** Node.js 22 LTS (TypeScript) | PostgreSQL 16  

---

## 1. Backlog Mapping Matrix (Sprint 1 to Sprint 13)

- **Sprint 1 (Backend Foundation & CI/CD):** Deploy PostgreSQL DDL, configure migrations runner, establish CI/CD scan pipelines.
- **Sprint 2 (Identity & RBAC):** Implement user login, MFA token generation, tenant isolation middleware, and negative RBAC security tests.
- **Sprint 3 (Document Types & Schemas):** CRUD APIs for versioned extraction schemas and validation rules.
- **Sprint 4 (Secure Intake & Storage):** Multipart upload handler, SHA-256 pre-hashing, S3 adapter, and malware quarantine.
- **Sprint 5 (Durable Queue & OCR):** BullMQ job queue integration, OCR layout polygon persistence, DLQ operator controls.
- **Sprint 6 (Classification & Extraction):** AI field candidate extraction, invoice line item calculation, bounding box mapping.
- **Sprint 7 (Human Review & UI Integration):** Review workbench APIs, field verification endpoints, and PDF.js canvas integration.
- **Sprint 8 (Approval Workflow):** Backend state machine for sequential/parallel approvals enforcing Separation of Duties (SoD).
- **Sprint 9 (Search & Version Compare):** PostgreSQL full-text/pgvector search with permission filters, clause diff comparison.
- **Sprint 10 (Grounded Q&A):** Grounded RAG retrieval, prompt injection defense, and citation authorization filters.
- **Sprint 11 (Notifications & Reports):** Governance telemetry APIs, authorized signed CSV export download, HMAC webhooks.
- **Sprint 12 (Retention & Legal Hold):** Policy-driven retention scheduler, legal hold freeze, and immutable multi-store purge.
- **Sprint 13 (UAT & Release):** Execute UAT-01 to UAT-12 scenarios, load testing, restore drill, and security sign-off.
