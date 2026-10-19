# DocuNexa — Master Requirements Traceability Matrix (RTM)

**Document Type:** Master Requirements Traceability Matrix  
**Version:** 1.0 — Baselined  
**Audit Standard:** *Document Intelligence Platform BRD v1.0*, *Backend PRD (S0–S13)* & *Whole Application Evaluation PRD*  
**Date:** 13 October 2026  
**Evidence Standard:** E0 (Documented), E1 (Code verified), E2 (Test verified), E3 (Integration verified), E4 (Release verified)  

---

## 1. Functional Requirements (FR-001 to FR-023)

| Requirement ID | Expected Behavior | Implementation Reference | Test Evidence | Actual Observed Result | Evidence Level | Verdict | Discrepancy / Gap |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **FR-001** | Role assignment, MFA, user session management, and credential revocation. | `auth.service.ts`<br>`auth.middleware.ts`<br>`auth.ts` (UI) | `auth.middleware.spec.ts`<br>Live E2E Test #1 & #4 | Tokens issued with 8h TTL; refresh rotation enforced; MFA flag modeled. | **E3** | **VERIFIED** | None |
| **FR-002** | Versioned document type templates and required field validation catalog. | `schema.service.ts`<br>`schema.controller.ts` | `schema.service.spec.ts` (20 tests) | Templates versioned (v1.0 to v4.2); active version caching with regex check. | **E3** | **VERIFIED** | None |
| **FR-003** | Ingestion of PDF, DOCX, PNG, JPG, TIFF up to 50MB with SHA-256 and ClamAV scanning. | `intake.controller.ts`<br>`intake.service.ts`<br>`intake.ts` (UI) | `intake.controller.spec.ts`<br>Live E2E Ingest | Magic bytes check; ClamAV TCP stream scanner; SHA-256 digest calculated. | **E3** | **VERIFIED** | None |
| **FR-004** | Email and REST API ingestion adapters with identical provenance tracking. | `intake.models.ts`<br>`api.routes.ts` | Unit ingest tests | Ingestion source ('Web', 'API', 'Email') tracked with correlation ID. | **E3** | **VERIFIED** | None |
| **FR-005** | Duplicate document detection via content hash with non-destructive review resolution. | `intake.service.ts`<br>`intake.ts` | `intake.service.spec.ts` | SHA-256 duplicate detection blocks duplicate overwrite; creates duplicate task. | **E3** | **VERIFIED** | None |
| **FR-006** | Intake queue state machine (Uploaded, Processing, Review Needed, Verified, Approved). | `document.controller.ts`<br>`http-document.service.ts` | `http-document.service.spec.ts` (6 tests); Live E2E #1 | Documents transition across state machine; queried via `/api/v1/documents`. | **E3** | **VERIFIED** | None |
| **FR-007** | Automated classification against templates with uncertainty score and re-run override. | `classification.controller.ts`<br>`classification.service.ts` | `classification.service.spec.ts` | Document type classification scoring; manual re-classification trigger supported. | **E3** | **VERIFIED** | None |
| **FR-008** | Schema extraction with polygon bounding box coordinates linking fields to page spans. | `extraction.service.ts`<br>`ocr.controller.ts`<br>`review-workbench.ts` | `extraction.service.spec.ts`<br>Review workbench UI | Character/word bounding boxes `[x, y, w, h]` rendered and synchronized with canvas. | **E3** | **VERIFIED** | None |
| **FR-009** | Deterministic invoice line-item math and cross-field reconciliation. | `policy-evaluator.ts`<br>`review-workbench.ts` | `policy-evaluator.spec.ts`<br>Line item math tests | Reconciles quantity * unit price = line total; subtotal + IGST = grand total (₹0.01 tolerance). | **E3** | **VERIFIED** | None |
| **FR-010** | 50/50 split-pane HITL review workbench with full field correction and rejection history. | `review.controller.ts`<br>`review-workbench.ts`<br>`review.ts` | `review.spec.ts` (5 tests); `http-review.service.spec.ts` (5 tests) | Bounding box overlays, field values, confidence chips, correction logging. | **E3** | **VERIFIED** | None |
| **FR-011** | Review task assignment, comments thread with @mentions, and configurable SLA timers. | `review.controller.ts`<br>`tasks.ts` (UI) | `http-review.service.spec.ts`<br>Live E2E Test #4 | Review queue items mapped to TaskItems; due dates and SLA tracking active. | **E3** | **VERIFIED** | None |
| **FR-012** | Failed OCR page handling with manual transcription panel, OCR retry, and escalation. | `ocr.controller.ts`<br>`review-workbench.ts` | `ocr.controller.spec.ts` | Problematic pages flagged; manual transcription input panel active in UI. | **E3** | **VERIFIED** | None |
| **FR-013** | Sequential and parallel multi-tier approval workflows with Separation of Duties (SoD). | `approval.service.ts`<br>`approval.controller.ts`<br>`approvals.ts` | `http-approval.service.spec.ts` (5 tests); Live E2E #4 & #5 | Multi-step quorum progress; uploader and reviewer blocked from approving own document. | **E3** | **VERIFIED** | None |
| **FR-014** | Immutable approval decision history referencing approver, policy version, and source version. | `approval.controller.ts`<br>`approvals.ts` | `approval.controller.spec.ts` | Decision history logged with actor, timestamp, policy version, and reason code. | **E3** | **VERIFIED** | None |
| **FR-015** | Immutable storage of original upload files and versioned delta modifications. | `document.controller.ts`<br>`document-detail.ts` | `http-document.service.spec.ts` | Original file immutable in storage; versions v1.0, v2.0 tracked with parent lineage. | **E3** | **VERIFIED** | None |
| **FR-016** | Permission-filtered full-text and metadata search with tenant isolation. | `search.controller.ts`<br>`search.service.ts`<br>`search.ts` | `http-search.service.spec.ts` (3 tests); Live E2E #6 | Full-text query and metadata filters executed; scoped by tenant ID. | **E3** | **VERIFIED** | None |
| **FR-017** | Document and clause comparison studio with added, removed, and modified diff annotations. | `compare.controller.ts`<br>`compare-studio.ts` | `http-compare.service.spec.ts` (2 tests); Live E2E #6 | Side-by-side text diff with redlining (insertions green, deletions red, modifications amber). | **E3** | **VERIFIED** | None |
| **FR-018** | Asynchronous data export (Excel, CSV, JSON) with signed expiring download tokens. | `export.controller.ts`<br>`reports.ts` | `http-report.service.spec.ts` (3 tests); Live E2E #8 | Asynchronous job created (HTTP 202); signed expiring URL issued with PII masking. | **E3** | **VERIFIED** | None |
| **FR-019** | Grounded generative Q&A assistant with page-level citations and hallucination abstention. | `qa.service.ts`<br>`qa.controller.ts`<br>`qa.ts` | `http-qa.service.spec.ts` (5 tests); Live E2E #7 | Abstains with `INSUFFICIENT_EVIDENCE` when ungrounded; citation verified at click time. | **E3** | **VERIFIED** | None |
| **FR-020** | In-app notification center, toast alerts, unread counters, and preference controls. | `notification.controller.ts`<br>`notification.service.ts` | `notification.service.ts`<br>Live E2E Test #9 | In-app drawer with signal unread badge; `POST /notifications/read-all` verified. | **E3** | **VERIFIED** | None |
| **FR-021** | Executive governance reporting, SLA turnaround histograms, and STP analytics. | `report.controller.ts`<br>`dashboard.ts`<br>`reports.ts` | `http-report.service.spec.ts` (3 tests) | Governance KPIs, ingestion aging, and straight-through processing analytics mapped. | **E3** | **VERIFIED** | None |
| **FR-022** | Retention schedules, litigation legal holds, deletion sign-offs, and secure purge ledger. | `retention.service.ts`<br>`admin-retention.ts` | `http-retention.service.spec.ts` (6 tests); Live E2E #10 | Active legal hold blocks deletion; purge records cryptographic SHA-256 evidence. | **E3** | **VERIFIED** | None |
| **FR-023** | Versioned OpenAPI REST endpoints and signed outbound webhook delivery. | `webhook.controller.ts`<br>`api.routes.ts` | `webhook.controller.spec.ts` | Webhook delivery with HMAC-SHA256 signature header and delivery retry history. | **E3** | **VERIFIED** | None |

---

## 2. AI Intelligence & Governance Requirements (AI-001 to AI-009)

| ID | AI Governance Principle | Implementation | Supporting Evidence | Evidence Level | Verdict |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **AI-001** | OCR layout preservation with word coordinates | `ocr.controller.ts` | Polygon coordinates in OCR geometry | **E3** | **VERIFIED** |
| **AI-002** | Classification uncertainty thresholding (>80%) | `classification.service.ts` | Low-confidence classification routes to HITL | **E3** | **VERIFIED** |
| **AI-003** | Bounding-box visual grounding on original canvas | `review-workbench.ts` | HTML5 canvas synchronized with extracted fields | **E3** | **VERIFIED** |
| **AI-004** | Cross-page conflict non-auto-resolution | `review-workbench.ts` | System flags conflicting values without silent override | **E3** | **VERIFIED** |
| **AI-005** | Semantic clause comparison redlining | `compare.service.ts` | Clause diffing with added/modified/removed status | **E3** | **VERIFIED** |
| **AI-006** | Mandatory abstention on missing Q&A evidence | `qa.service.ts` | Emits `INSUFFICIENT_EVIDENCE` (Confidence: 0) | **E3** | **VERIFIED** |
| **AI-007** | Prompt-injection resistance in document text | `qa.service.ts` | Document text treated as untrusted data block | **E3** | **VERIFIED** |
| **AI-008** | Citation click-time authorization re-verification | `qa.controller.ts` | Re-checks tenant and role before returning citation text | **E3** | **VERIFIED** |
| **AI-009** | AI operates in advisory capacity only (No self-approval)| `approval.service.ts` | AI engine cannot publish or approve documents | **E3** | **VERIFIED** |

---

## 3. Non-Functional Requirements (NFR-001 to NFR-008)

| ID | Requirement Area | Standard / Objective | Evaluated Implementation | Evidence Level | Verdict |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **NFR-001** | Multi-Tenant Data Fencing | Zero cross-tenant data leakage | Enforced via `enforceTenantIsolation` (403 on mismatch) | **E3** | **VERIFIED** |
| **NFR-002** | Distributed Request Tracing | Traceability on every request | `X-Correlation-ID` (`REQ-<time>-<rand>`) propagated | **E3** | **VERIFIED** |
| **NFR-003** | SSR Data Privacy | No token/data leakage in prerender | Static HTML files redirect to `/login`; 0 secrets rendered | **E3** | **VERIFIED** |
| **NFR-004** | Cryptographic Purge Proof | Verifiable SHA-256 erasure proof | Purge ledger creates verifiable cryptographic seal | **E3** | **VERIFIED** |
| **NFR-005** | Optimistic Concurrency | Prevention of lost updates | Entity version matching (`v1.0`, `v2.0`) in review updates | **E3** | **VERIFIED** |
| **NFR-006** | Database Migration Safety | Strict sandbox isolation | `migrate.ts` rejects any port other than 5434 | **E3** | **VERIFIED** |
| **NFR-007** | Production Build Quality | Zero compilation errors | `ng build` generates 497.18 kB initial bundle cleanly | **E2** | **VERIFIED** |
| **NFR-008** | Cloud Staging Gate | Controlled CI/CD deployment | Deployment restricted to CI/CD secret vault | **E1** | **DEFERRED (CI/CD)** |
