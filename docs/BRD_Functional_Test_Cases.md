# BRD Functional Test Cases & Verification Catalog

**Authoritative Baseline:** Document Intelligence Platform BRD v1.0 Section 5  
**System:** DocNexa Enterprise Document Intelligence Platform  
**Total Functional Requirements:** 23 (21 Must, 2 Should)  
**Execution Outcome:** ✅ **23 / 23 Passed (100%)**

---

## Group 1: Tenant, Configuration, and Intake (FR-001 to FR-006)

### TC-FR-001: User Invitation, Scoped RBAC, Deactivation & MFA
* **Requirement:** Invite users, assign scoped roles, deactivate access, and configure MFA. Revoked users cannot access UI, API, file, snippet, or export.
* **Test Suite:** `backend/src/services/auth.service.spec.ts`, `backend/src/middleware/auth.middleware.spec.ts`
* **Test Case IDs:** `AUTH-01` through `AUTH-10`, `MID-AUTH-01` to `MID-AUTH-07`
* **Execution Evidence:**
  - Login returns 15m JWT + 7d rotating refresh token family.
  - Revoking session via `POST /api/v1/auth/logout` rejects subsequent calls with `HTTP 401 UNAUTHORIZED`.
  - Replay of revoked refresh token triggers automatic family-wide compromise revocation (`HTTP 401 TOKEN_REPLAY_DETECTED`).
  - MFA email verification delivers 6-digit OTP via Nodemailer transporter.
* **Result:** ✅ PASS

### TC-FR-002: Versioned Document Type Templates & Required Field Rules
* **Requirement:** Create versioned document type templates and required field rules. Historical documents retain the template version used for extraction.
* **Test Suite:** `backend/src/services/schema.service.spec.ts`, `backend/src/controllers/schema.controller.spec.ts`
* **Test Case IDs:** `SCHEMA-01` through `SCHEMA-24`
* **Execution Evidence:**
  - Seeded document types: `purchase-invoice` (v2.1), `supplier-contract` (v1.4), `internal-policy` (v4.2).
  - Draft template creation, publishing, and immutable freezing verified. Historical extractions maintain explicit reference to template version string.
* **Result:** ✅ PASS

### TC-FR-003: Upload File Validation, ClamAV Malware Scan, Size Limits & SHA-256
* **Requirement:** Upload PDF, DOCX, and image files with scan, limit, and checksum. Invalid or malicious file rejected with status and event.
* **Test Suite:** `backend/src/utils/file-validator.spec.ts`, `backend/src/services/scanner.service.spec.ts`, `backend/src/services/intake.service.spec.ts`
* **Test Case IDs:** `VAL-01` to `VAL-19`, `SCAN-01` to `SCAN-04`, `INT-01` to `INT-14`
* **Execution Evidence:**
  - Pre-flight magic byte inspection detects PDF (`%PDF-`), PNG, JPEG, TIFF, and DOCX. Extension spoofing (e.g. `.exe` renamed to `.pdf`) rejected with `HTTP 400 INVALID_FILE_TYPE`.
  - Files exceeding 50 MB rejected with `HTTP 413 FILE_TOO_LARGE`.
  - EICAR test signature triggers ClamAV quarantine isolation with `HTTP 422 MALWARE_DETECTED`.
  - Checksum computed via SHA-256 and stored with tenant-scoped uniqueness constraint `documents_tenant_sha256_key`.
* **Result:** ✅ PASS

### TC-FR-004: Multi-Channel Ingestion (Web, REST API, Email Adapter)
* **Requirement:** Create intake via web, API, and configurable email adapter. Same validation and provenance apply to each source.
* **Test Suite:** `backend/src/controllers/intake.controller.spec.ts`, `backend/src/services/intake.qa.spec.ts`
* **Test Case IDs:** `INT-CTRL-01` to `INT-CTRL-13`, `INT-QA-01` to `INT-QA-15`
* **Execution Evidence:**
  - Web multipart upload, direct REST API buffer payload, and email adapter payloads routed through the identical validation gate (`validateUploadFile`).
  - Metadata correctly stores `ingestionSource` as `'MANUAL_UPLOAD'`, `'API_CONNECTOR'`, or `'EMAIL_INGEST'`.
* **Result:** ✅ PASS

### TC-FR-005: Duplicate File/Record Suggestions & Reviewed Resolution
* **Requirement:** Suggest duplicate files/records and allow reviewed resolution. No silent overwrite; reviewer sees version and association options.
* **Test Suite:** `backend/src/services/intake.service.spec.ts`, `backend/src/services/release-sprint13.spec.ts` (UAT-03)
* **Test Case IDs:** `INT-DUP-01`, `INT-DUP-02`
* **Execution Evidence:**
  - Uploading a document with an identical SHA-256 hash in the same tenant triggers `HTTP 409 DUPLICATE_DOCUMENT` containing the existing document ID.
  - UI displays duplicate candidate banner allowing reviewer to link, associate, or spawn a new version branch. Silent overwrite is strictly prevented.
* **Result:** ✅ PASS

### TC-FR-006: Intake Tracking, Status Lifecycle & Resilient Retry
* **Requirement:** Track intake status and retry or route failed processing. Failure reason, attempt history, and safe retry are visible.
* **Test Suite:** `backend/src/controllers/document.controller.spec.ts`, `backend/src/services/intake.service.spec.ts`
* **Test Case IDs:** `DOC-01`, `DOC-02`
* **Execution Evidence:**
  - State machine transitions: `PENDING_SCAN` $\rightarrow$ `PROCESSING` $\rightarrow$ `NEEDS_REVIEW` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` / `REJECTED`.
  - Failed processing states record error cause and attempt counter; `POST /api/v1/documents/:id/retry` re-queues OCR/classification without duplicate entry.
* **Result:** ✅ PASS

---

## Group 2: Extraction and Review (FR-007 to FR-012)

### TC-FR-007: Document Classification with Uncertainty Routing
* **Requirement:** Classify the document against configured types with uncertainty. Reviewer can change type; extraction reruns under the selected schema.
* **Test Suite:** `backend/src/services/classification.service.spec.ts`, `backend/src/controllers/classification.controller.spec.ts`
* **Test Case IDs:** `CLS-01` to `CLS-12`, `CLS-CTRL-01` to `CLS-CTRL-08`
* **Execution Evidence:**
  - Documents with confidence $\ge 0.70$ auto-classified into `Supplier Contract`, `Purchase Invoice`, or `Internal Policy`.
  - Ambiguous classifications (< 0.70) flagged as `UNCERTAIN` and routed to the reviewer workbench. Reviewer override triggers re-extraction under the selected target schema.
* **Result:** ✅ PASS

### TC-FR-008: Field & Table Extraction with Geometry Provenance
* **Requirement:** Extract fields and tables with page/location evidence. Each proposed value displays source and extraction version.
* **Test Suite:** `backend/src/services/extraction.service.spec.ts`, `backend/src/controllers/extraction.controller.spec.ts`
* **Test Case IDs:** `EXT-01` to `EXT-18`
* **Execution Evidence:**
  - Extracted fields contain normalized bounding boxes $[x, y, w, h]$ and 8-point clockwise polygon arrays.
  - Each extracted field records: `sourceValue`, `pageNumber`, `confidenceScore` (0.0000–1.0000), `extractionVersion`, and `modelId`.
* **Result:** ✅ PASS

### TC-FR-009: Deterministic Type, Format, Arithmetic & Cross-Field Validations
* **Requirement:** Apply type, format, arithmetic, and cross-field validations. Mandatory exceptions block approval until resolved or authorized override.
* **Test Suite:** `backend/src/utils/schema-validator.spec.ts`, `backend/src/services/release-sprint13.spec.ts` (UAT-05)
* **Test Case IDs:** `SCH-VAL-01` to `SCH-VAL-15`
* **Execution Evidence:**
  - Evaluates regex patterns, ISO-8601 date order (Effective Date $\le$ Expiration Date), and tax ID formats.
  - Invoice math engine checks $\sum(\text{Qty} \times \text{Rate}) + \text{Tax} = \text{Total}$. Discrepancy $> ₹0.01$ raises a blocking exception `ERR-MATH-01`.
* **Result:** ✅ PASS

### TC-FR-010: 50/50 Split-Screen Reviewer Workbench & Correction History
* **Requirement:** Provide side-by-side source viewer and correction workspace. Reviewer can accept/edit/reject values; correction history retained.
* **Test Suite:** `backend/src/services/review.service.spec.ts`, `document-intelligence-ui/src/app/features/review/review.spec.ts`
* **Test Case IDs:** `REV-01` to `REV-11`, `UI-REV-01` to `UI-REV-05`
* **Execution Evidence:**
  - Synchronized dual-pane layout: original document on left, extracted fields on right. Focusing a form field highlights and scrolls the SVG bounding box halo on the document canvas.
  - Reviewer edits preserve original OCR value alongside corrected value, reviewer user ID, and timestamp.
* **Result:** ✅ PASS

### TC-FR-011: Comments, Reviewer Assignment, Due Dates & Clarification
* **Requirement:** Support comment, assignment, task due date, and clarification. Assignee and status visible; all actions timestamped.
* **Test Suite:** `backend/src/services/review.service.spec.ts`, `backend/src/controllers/review.controller.spec.ts`
* **Test Case IDs:** `REV-COM-01`, `REV-ASN-01`
* **Execution Evidence:**
  - Comments recorded with timestamp, author, and clarification thread tags.
  - Document assignments update review task queue (`SCR-10`) with countdown to SLA deadline.
* **Result:** ✅ PASS

### TC-FR-012: Failed OCR & Unsupported Language Handling
* **Requirement:** Handle pages with failed OCR or unsupported language. Affected pages marked; manual entry and escalation available.
* **Test Suite:** `backend/src/services/ocr.service.spec.ts`, `backend/src/controllers/ocr.controller.spec.ts`
* **Test Case IDs:** `OCR-01` to `OCR-15`
* **Execution Evidence:**
  - Pages with low DPI or garbled text marked with `PAGE_OCR_FAILED`.
  - Document remains accessible; review workbench provides manual form entry and supervisor escalation.
* **Result:** ✅ PASS

---

## Group 3: Approval, Repository, and Discovery (FR-013 to FR-023)

### TC-FR-013: Configurable Multi-Stage Approval Workflow & SoD
* **Requirement:** Apply configurable sequential/parallel approval workflow. Only assigned approver advances a valid step; separation rules enforced.
* **Test Suite:** `backend/src/services/approval.service.spec.ts`, `backend/src/controllers/approval.controller.spec.ts`, `backend/src/services/rbac-verification.spec.ts`
* **Test Case IDs:** `APP-01` to `APP-14`, `RBAC-SOD-01` to `RBAC-SOD-03`
* **Execution Evidence:**
  - Multi-tier thresholds: Tier 1 ($< \$10,000$, 1 approver), Tier 2 ($< \$50,000$, 2 approvers), Tier 3 ($\ge \$50,000$, Executive approval).
  - Submitter and reviewer self-approval blocked with `HTTP 403 SOD_VIOLATION`.
* **Result:** ✅ PASS

### TC-FR-014: Approval/Rejection with Reasons & Cryptographic Audit
* **Requirement:** Approve, reject, or return with reason and immutable event history. Published record references approver, policy version, and source version.
* **Test Suite:** `backend/src/services/approval.service.spec.ts`, `backend/src/services/audit.service.spec.ts`
* **Test Case IDs:** `APP-DEC-01` to `APP-DEC-06`, `AUD-01` to `AUD-09`
* **Execution Evidence:**
  - Rejection requires mandatory rejection codes (`ERR-MATH-01`, `ERR-CONTRACT-02`, etc.) and comment.
  - Decisions produce audit records sealed with HMAC-SHA256 (`AUDIT_HMAC_SECRET`).
* **Result:** ✅ PASS

### TC-FR-015: Immutable Originals & Versioned Replacements
* **Requirement:** Store immutable original and versioned replacement files. Prior version retrievable by authorized users; new file restarts review.
* **Test Suite:** `backend/src/services/intake.service.spec.ts`, `backend/src/services/release-sprint13.spec.ts` (UAT-01)
* **Test Case IDs:** `INT-VER-01`, `INT-VER-02`
* **Execution Evidence:**
  - Original file content in object storage is write-once.
  - Uploading replacement file generates new version entry (`v2.0`), links `parentDocumentId`, and initiates clean review cycle while retaining baseline `v1.0`.
* **Result:** ✅ PASS

### TC-FR-016: Permission-Aware Metadata & Full-Text Search
* **Requirement:** Search metadata and full text with tenant/document permissions. Filters and snippets obey field/document access; deleted files absent.
* **Test Suite:** `backend/src/services/search.service.spec.ts`, `backend/src/controllers/search.controller.spec.ts`
* **Test Case IDs:** `SRCH-01` to `SRCH-16`
* **Execution Evidence:**
  - Hybrid search combines PostgreSQL full-text index with pgvector cosine distance.
  - Results enforce tenant boundaries and persona shielding: Platform Operator receives 0 matches; Auditor receives only published/approved records. PII in snippets is masked.
* **Result:** ✅ PASS

### TC-FR-017: Two-Version Diff & Clause Studio
* **Requirement:** Compare two versions for text, fields, and clauses. Added, removed, changed, and uncertain spans shown with source locations.
* **Test Suite:** `backend/src/services/compare.service.spec.ts`, `backend/src/controllers/compare.controller.spec.ts`
* **Test Case IDs:** `CMP-01` to `CMP-12`
* **Execution Evidence:**
  - Evaluates word-level diffs (`v1Chunks`, `v2Chunks`, `unifiedChunks`).
  - Classifies contract amendment risk: `High` (uncapped liability), `Medium` (evergreen auto-renewal, 24h breach notice), `Low` (payment term adjustments), `None` (editorial). Suggests AI legal fallback clauses.
* **Result:** ✅ PASS

### TC-FR-018: Scoped, Audit-Logged Document & Data Exports
* **Requirement:** Export approved metadata and files under scope rules. Export filters match UI and are audit logged.
* **Test Suite:** `backend/src/services/export.service.spec.ts`, `backend/src/controllers/export.controller.spec.ts`
* **Test Case IDs:** `EXP-01` to `EXP-12`
* **Execution Evidence:**
  - Asynchronous export generation produces CSV/JSON/ZIP bundles with SHA-256 integrity seal.
  - Export requests logged to audit repository; unapproved documents excluded unless actor possesses `EXPORT_UNRESTRICTED` permission.
* **Result:** ✅ PASS

### TC-FR-019: Grounded Document Q&A with Page Citations & Abstention
* **Requirement:** Provide grounded document Q&A with citations and abstention. Answer only from permitted, selected versions; citations open exact pages.
* **Test Suite:** `backend/src/services/qa.service.spec.ts`, `backend/src/controllers/qa.controller.spec.ts`, `backend/src/services/qa-security.spec.ts`
* **Test Case IDs:** `QA-01` to `QA-18`, `QA-SEC-01` to `QA-SEC-06`
* **Execution Evidence:**
  - Retrieval searches only permitted tenant documents. Answers contain exact page citations (`v1.0 Page 2, Para 4`).
  - When evidence is insufficient or question is unanswerable from source text, Q&A strictly abstains (`abstain: true`).
  - Adversarial prompt injection instructions embedded in document text are neutralized.
* **Result:** ✅ PASS

### TC-FR-020: Notifications (Task, Failure, Approval, Expiry)
* **Requirement:** Deliver task, failure, approval, and expiry notifications. Recipients, delivery states, retries, and template versions visible.
* **Test Suite:** `backend/src/services/notification.service.spec.ts`, `backend/src/controllers/notification.controller.spec.ts`
* **Test Case IDs:** `NOTIF-01` to `NOTIF-14`
* **Execution Evidence:**
  - Event triggers dispatch notifications for review assignment, SLA warnings, and approval outcomes.
  - Delivery states (`PENDING`, `DELIVERED`, `FAILED`) and retry counters tracked. Live SMTP delivery integrated with local mailer fallback.
* **Result:** ✅ PASS

### TC-FR-021: Operational Telemetry & Governance Reports
* **Requirement:** Provide volume, aging, exception, accuracy, and approval reports. Counts reconcile with filtered records and role permissions.
* **Test Suite:** `backend/src/services/report.service.spec.ts`, `backend/src/controllers/report.controller.spec.ts`
* **Test Case IDs:** `REP-01` to `REP-14`
* **Execution Evidence:**
  - Live API aggregations provide throughput counts, review queue depth, SLA breach rates, and model precision/recall.
  - Telemetry counts strictly reflect records accessible to the requesting user persona.
* **Result:** ✅ PASS

### TC-FR-022: Retention Governance, Legal Hold Freeze & Verifiable Purge
* **Requirement:** Support retention hold, deletion request, and purge tracking. Source and derivative stores have verifiable completion or exception.
* **Test Suite:** `backend/src/services/retention.service.spec.ts`, `backend/src/controllers/retention.controller.spec.ts`
* **Test Case IDs:** `RET-01` to `RET-16`
* **Execution Evidence:**
  - Legal hold freeze suspends deletion cases; document cannot be purged or modified while under active hold.
  - Authorized deletion case destroys binaries, OCR text, vector chunks, and caches, generating a verifiable cryptographic purge seal (`sha256`).
* **Result:** ✅ PASS

### TC-FR-023: Versioned REST API & Outbound Signed Webhooks
* **Requirement:** Expose versioned API and outbound signed webhooks. Retry is idempotent; signature and delivery failure tested.
* **Test Suite:** `backend/src/services/webhook.service.spec.ts`, `backend/src/controllers/webhook.controller.spec.ts`
* **Test Case IDs:** `WH-01` to `WH-14`
* **Execution Evidence:**
  - Webhook subscriptions support HMAC-SHA256 signature verification in header `X-DocNexa-Signature`.
  - Exponential backoff retry schedule (1s, 5s, 30s) handles destination outages; delivery history recorded with replay protection window.
* **Result:** ✅ PASS
