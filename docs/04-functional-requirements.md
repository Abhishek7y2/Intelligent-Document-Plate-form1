# 04. Functional Requirements Specifications (FR-001 - FR-023)

## Overview
This document specifies the complete functional requirement inventory for DocuNexa, detailing inputs, business rules, outputs, validation constraints, and actual implementation status in the codebase.

---

### FR-001: Multi-Channel Document Ingestion
* **Description**: The system must ingest documents via web browser, REST API, email hooks, and mobile scanner.
* **Inputs**: Binary files (PDF, TIFF, PNG, JPEG, DOCX) up to 50MB.
* **Validation Rules**: Check magic bytes, verify MIME type, reject password-protected or encrypted PDFs without credentials.
* **Outputs**: Ingestion Batch ID, UUID per document, SHA-256 hash.
* **Status**: **STATUS: IMPLEMENTED** (Web UI: `intake-studio.ts`, REST API: `api/upload-api.md`)

### FR-002: Pre-flight Antivirus & Quarantine Sandboxing
* **Description**: Ingested files must be scanned for malicious signatures before processing.
* **Inputs**: Uploaded binary stream.
* **Validation Rules**: If infected or structurally malformed, isolate file into quarantine storage, revoke public read access, alert Admin.
* **Outputs**: Quarantine flag `is_quarantined = true`, incident audit log entry.
* **Status**: **STATUS: IMPLEMENTED** (UI quarantine tab in `intake-studio.ts`; ClamAV backend spec in `backend/integrations.md`)

### FR-003: High-Resolution Optical Character Recognition (OCR)
* **Description**: Rasterize documents at 300 DPI and extract text, spatial polygons, and language metadata.
* **Inputs**: Document image/page stream.
* **Validation Rules**: Deskew up to $pm 45^circ$, orientation auto-correction ($90^circ, 180^circ, 270^circ$).
* **Outputs**: Token list with `{ text, confidence, polygon: [x1,y1, x2,y2, x3,y3, x4,y4], page }`.
* **Status**: **STATUS: IMPLEMENTED** (Canvas overlay in `review-detail.ts`; OCR service spec in `ai/ocr.md`)

### FR-004: Automated Document Classification
* **Description**: Classify documents into domain categories (Invoice, Contract, Financial Statement, Tax Form, Identity Record).
* **Inputs**: OCR text tokens and visual layout embedding.
* **Validation Rules**: If classification confidence $<80%$, route to manual triage queue.
* **Outputs**: `document_type`, classification confidence score.
* **Status**: **STATUS: IMPLEMENTED** (Classification badges in `document-detail.ts`)

### FR-005: Layout-Aware Key-Value & Entity Extraction
* **Description**: Extract structured business fields based on document taxonomy (e.g., Invoice Number, Vendor, Due Date, Tax Amount).
* **Inputs**: OCR token layout graph.
* **Validation Rules**: Regex normalization on dates (`YYYY-MM-DD`), amounts (decimal floats), tax IDs.
* **Outputs**: JSON entity map with field-level confidence ratings.
* **Status**: **STATUS: IMPLEMENTED** (Entity table in `review-detail.ts`)

### FR-006: Grounded Visual Evidence Mapping
* **Description**: Every extracted field must link to a visual bounding box on the original document.
* **Inputs**: Extracted field ID, source polygon coordinates.
* **Validation Rules**: Clicking a field must pan and highlight the bounding box; clicking a bounding box must focus the input.
* **Outputs**: Interactive canvas highlight overlays.
* **Status**: **STATUS: IMPLEMENTED** (Synchronized canvas in `review-detail.ts` and `review-detail.html`)

### FR-007: Invoice Mathematical Validation Engine
* **Description**: Execute automated reconciliation checks on extracted financial data.
* **Validation Formula**: $left| (sum 	ext{Line Item Totals}) - 	ext{Subtotal} ight| le 0.01$ and $left| 	ext{Subtotal} + 	ext{Tax} + 	ext{Shipping} - 	ext{Grand Total} ight| le 0.01$.
* **Outputs**: Math status: `MATCH` (Green), `MISMATCH` (Red warning banner).
* **Status**: **STATUS: IMPLEMENTED** (Invoice Math panel in `review-detail.ts`)

### FR-008: Human-in-the-Loop (HITL) Review Queue
* **Description**: Route documents with low confidence ($<85%$), rule violations, or unmapped fields to reviewers.
* **Validation Rules**: Reviewer can edit values, re-assign bounding boxes, or flag for supervisor review.
* **Outputs**: Updated document state: `REVIEWED`, field edit audit log.
* **Status**: **STATUS: IMPLEMENTED** (Review queue and split-screen studio in `review-queue.ts`)

### FR-009: Quality Assurance (QA) Sampling Engine
* **Description**: Randomly sample a configurable percentage ($5%-100%$) of approved documents for independent QA verification.
* **Validation Rules**: QA auditor grades reviewer accuracy, records error codes, and approves/rejects QA pass.
* **Outputs**: QA score, compliance attestation.
* **Status**: **STATUS: IMPLEMENTED** (QA tabs and actions in `approvals.ts`)

### FR-010: Separation of Duties (SoD) Enforcer
* **Description**: Enforce financial dual-control principles.
* **Validation Rules**: The user who uploaded or reviewed a document is strictly prohibited from granting approval.
* **Outputs**: Exception dialog blocking approval; audit warning log.
* **Status**: **STATUS: IMPLEMENTED** (SoD validation logic in `approvals.ts`)

### FR-011: Multi-Level Approval Workflow
* **Description**: Route documents for operational and financial sign-off based on dollar thresholds ($<$10k$, $10k-$50k, >$50k).
* **Validation Rules**: Mandatory approval comments; digital signature recorded with timestamp and IP.
* **Outputs**: Document status: `APPROVED` or `REJECTED`.
* **Status**: **STATUS: IMPLEMENTED** (Approval studio and modal in `approvals.ts`)

### FR-012: Document Version Comparison Studio
* **Description**: Compare two versions of a document (e.g., Contract v1 vs Contract v2).
* **Outputs**: Side-by-side visual diff, text redlining (insertions/deletions), line-item change grid.
* **Status**: **STATUS: IMPLEMENTED** (`compare-studio.ts` and `compare-studio.html`)

### FR-013: Grounded Conversational Q&A
* **Description**: Answer natural language questions using verified document content.
* **Validation Rules**: Every claim must have an inline citation tag with page number and verbatim excerpt.
* **Outputs**: Answer synthesis, source document links, confidence indicator.
* **Status**: **STATUS: IMPLEMENTED** (`grounded-qa.ts`)

### FR-014: Full-Text and Metadata Hybrid Search
* **Description**: Query documents across metadata fields, extracted text, and vector semantics.
* **Filters**: Document type, date range, approval status, confidence range, vendor name.
* **Outputs**: Paginated document cards with highlighted text snippets.
* **Status**: **STATUS: IMPLEMENTED** (`search-studio.ts`)

### FR-015: Role-Based Access Control (RBAC)
* **Description**: Restrict platform actions based on assigned role.
* **Roles**: Admin, Reviewer, Approver, QA Auditor, Operator, Viewer.
* **Outputs**: Dynamic UI route guards and action button permissions.
* **Status**: **STATUS: IMPLEMENTED** (`auth.service.ts`, `admin-studio.ts`)

### FR-016: Document Retention Policy Scheduler
* **Description**: Enforce regulatory lifecycle periods (e.g., 7-year retention).
* **Outputs**: Retention expiration countdown, automatic eligibility for purge.
* **Status**: **STATUS: IMPLEMENTED** (`admin-studio.ts`)

### FR-017: Litigation Legal Hold Manager
* **Description**: Freeze retention expiration for documents under legal subpoena.
* **Validation Rules**: Document cannot be deleted or purged while Legal Hold is active.
* **Outputs**: Legal Hold lock badge, frozen purge timer.
* **Status**: **STATUS: IMPLEMENTED** (`admin-studio.ts`)

### FR-018: Cryptographic Secure Purge
* **Description**: Permanently delete expired records with zero-fill overwriting.
* **Outputs**: Cryptographic Deletion Certificate with SHA-256 proof.
* **Status**: **STATUS: IMPLEMENTED** (`admin-studio.ts`)

### FR-019: Native iOS Document Scanner & Review App
* **Description**: Mobile app with camera edge detection, perspective correction, and mobile approvals.
* **Status**: **STATUS: SPECIFIED IN ARCHITECTURE** (Documented in `mobile/` specs)

### FR-020: Relational Database with pgvector
* **Description**: Normalized PostgreSQL persistence storing tenants, documents, entities, bounding boxes, and embeddings.
* **Status**: **STATUS: SPECIFIED IN ARCHITECTURE** (Documented in `database/` DDL specs)

### FR-021: Node.js Backend Microservices & Workers
* **Description**: RESTful API endpoints, BullMQ async processing workers, and webhook dispatcher.
* **Status**: **STATUS: PARTIALLY IMPLEMENTED** (API contracts & NestJS/Express specs documented in `backend/` & `api/`)

### FR-022: Immutable Audit Logging
* **Description**: Log all user actions, logins, status changes, and data modifications.
* **Outputs**: Tamper-evident audit log table with user ID, IP address, timestamp, and before/after JSON diffs.
* **Status**: **STATUS: IMPLEMENTED** (`admin-studio.ts`)

### FR-023: System Health & Performance Monitoring
* **Description**: Track pipeline processing latency, queue depth, error rates, and system uptime.
* **Outputs**: Real-time health metrics dashboard.
* **Status**: **STATUS: IMPLEMENTED** (`dashboard.ts`, `admin-studio.ts`)
