# DocuNexa Backend Product Requirements Document & Sprint Execution Plan

**Version:** 1.0 — Execution Baseline  
**Date:** 09 October 2026  
**Focus:** Backend REST APIs, Persistence, Async Processing, AI Pipeline, Security & Sprint Roadmap  

---

## 1. Executive Summary & Product Outcomes

DocuNexa is an enterprise document-intelligence platform that accepts business documents, validates and stores originals, extracts text and structured fields, routes uncertain results to human reviewers, enforces configurable approvals, publishes approved records, supports search and version comparison, answers questions with evidence-backed citations, and manages retention, legal hold, exports, audit, and integrations.

### Primary Goals:
- Transition from mock Angular 19 frontend to a secure, persistent, observable, testable Node.js backend.
- Enforce strict human-in-the-loop controls (AI proposals remain advisory; AI never autonomously approves, deletes, or publishes data).
- Target MVP Document Types: **Supplier Contract**, **Purchase Invoice**, and **Internal Policy**.

---

## 2. Sprint Roadmap Summary (Sprint 0 to Sprint 13)

| Sprint | Sprint Focus | Priority | Primary Exit Criteria & Deliverables |
| :--- | :--- | :---: | :--- |
| **S0** | **Architecture & Requirements Baseline** | `P0` | Signed ADR-001 (Node.js stack) & ADR-002 (PostgreSQL + pgvector). Requirements frozen. |
| **S1** | **Backend Foundation, CI/CD & Observability** | `P0` | Bootable Node.js API service, Docker Compose, baseline migrations, health endpoints. |
| **S2** | **Identity, Sessions, Tenancy & RBAC** | `P0` | Multi-tenant RBAC, JWT access/refresh token rotation, negative cross-tenant tests pass. |
| **S3** | **Document Types, Templates & Schema Config** | `P0` | Versioned document-type schemas, validation rules, and approval route CRUD APIs. |
| **S4** | **Secure Intake, Object Storage & Versioning** | `P0` | Multipart upload API, SHA-256 pre-hash, private S3 storage, malware quarantine state. |
| **S5** | **Durable Queue & OCR Orchestration** | `P0` | BullMQ Redis queue, job retry/backoff, DLQ handling, OCR layout polygon persistence. |
| **S6** | **Classification, Extraction & Rules** | `P0` | AI field candidate extraction with source coordinates and arithmetic validation. |
| **S7** | **Human Review, Corrections & Frontend Integration**| `P0` | Review queue APIs, Angular `HttpClient` integration (replacing `Mock*Service`), PDF.js canvas. |
| **S8** | **Approval Workflow & Publication** | `P0` | Backend state machine enforcing Separation of Duties (SoD) and blocking unresolved errors. |
| **S9** | **Repository, Search & Clause Compare** | `P0` | Permission-filtered search, PostgreSQL full-text / pgvector search, side-by-side clause diff. |
| **S10** | **Grounded Q&A & AI Safety Evaluation** | `P0` | RAG retrieval filter, prompt injection defense, citation authorization, abstention handling. |
| **S11** | **Notifications, Reports & Exports** | `P1` | Telemetry KPIs, authorized signed CSV export download, webhook delivery with HMAC. |
| **S12** | **Retention, Legal Hold & Secure Purge** | `P0` | Policy-driven deletion scheduler, legal hold freeze, multi-store immutable deletion. |
| **S13** | **Integration, Security, Load & Release** | `P0` | UAT-01 to UAT-12 scenario execution, load testing, security sign-off, release readiness. |

---

## 3. Core Domain Invariants & Rules

1. **Tenant Isolation:** Mandatory on every database record, S3 storage key, search hit, and export.
2. **Immutable Originals:** Original files are immutable; replacement uploads create a new source version.
3. **PostgreSQL as Source of Truth:** PostgreSQL owns workflow state and approved structured values; search indexes and AI embeddings are derived and rebuildable.
4. **Human Control Gate:** AI outputs are advisory. Human reviewers and authorized approvers retain sole authority for corrections and publication.
