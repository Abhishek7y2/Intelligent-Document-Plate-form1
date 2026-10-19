# DocuNexa Sprint 5 — OCR and Document Geometry Pipeline Execution Report

**Date:** 2026-10-12  
**Roles:** Principal Backend Engineer, AI/OCR Specialist, PostgreSQL Architect, QA Lead  
**Sprint Target:** Sprint 5 — High-Resolution OCR, Spatial Layout Token Extraction & Document Geometry Pipeline (BRD: FR-003, FR-005, FR-006)  
**Overall Verdict:** ⚠️ **CONDITIONAL PASS**  
*(Source-Code Implementation: **100% PASS** | Unit & Integration Tests: **100% PASS (160/160 tests across 15 suites)** | TypeScript Build & Lint: **PASS (0 errors)** | Live PostgreSQL 16 Migration Gate: **BLOCKED** Pending Sandbox Provisioning)*  
**Host Database Safety:** Preserved intact. PostgreSQL 12.12 on `127.0.0.1:5433` (`docunexa`, 49 public tables) was **not modified, migrated, or altered**.

---

## 1. Executive Summary & Verification Matrix

Sprint 5 implements the **High-Resolution Optical Character Recognition (OCR) and Document Geometry Pipeline** in full alignment with the approved technology stack (Node.js 22 LTS, TypeScript 5.5, Express, PostgreSQL 16) and BRD requirements (FR-003, FR-005, FR-006).

### Verification Scorecard

| Category | Checks / Suites | Results | Status |
|:---|:---|:---:|:---:|
| **TypeScript Compilation** | `npm run build` (`tsc`) | Clean compile; output in `backend/dist/` | **PASS** |
| **ESLint Validation** | `npm run lint` (`eslint src`) | 0 errors, 7 acceptable mock warnings | **PASS** |
| **Sprint 5 OCR Service Tests** | `src/services/ocr.service.spec.ts` | **20 passed, 0 failed** | **PASS** |
| **Sprint 5 OCR Controller Tests**| `src/controllers/ocr.controller.spec.ts` | **10 passed, 0 failed** | **PASS** |
| **Full Regression Suite** | `npm test` across all 15 test suites | **160 passed, 0 failed** | **PASS** |
| **Live Database Migrations** | `006_ocr_geometry_and_pages.sql` | Static DDL reviewed; host database preserved | ⏸️ **BLOCKED** |

---

## 2. Step 1: Repository Discovery & State Verification

1. **How Accepted Files Are Retrieved:**
   - Ingested files from Sprint 4 are stored under server-controlled paths: `tenants/${tenantId}/raw/${documentId}.${ext}`.
   - Files are stored and retrieved strictly through the approved `ObjectStorageService` abstraction (`MemoryStorageService` for unit tests, `LocalStorageService` at `data/storage` for local filesystem persistence, with S3 planned).
   - In Sprint 5, `IntakeService.getStorage()` was exposed so that processing pipelines retrieve files through the exact approved storage abstraction.
2. **Current Persistence Mode in Sprint 4 & Sprint 5:**
   - Default mode is `storeMode = 'memory'` with in-memory collections (`inMemoryDocs`, `inMemoryOcrResults`), which allows self-contained tests without modifying the unmigrated host database on port 5433.
   - Full PostgreSQL 16 database mode (`storeMode = 'database'`) is implemented in parallel using `dbPool.query()`.
3. **Sprint 5 Requirement Inventory:**
   - **FR-003:** High-Resolution Optical Character Recognition (OCR) rasterizing at 300 DPI, generating tokens with `{ text, confidence, polygon: [x1,y1, x2,y2, x3,y3, x4,y4], page }`.
   - **FR-005 & FR-006:** Spatial bounding box metadata linked to document geometry for Review Workbench canvas rendering.

---

## 3. Step 2: Processing Eligibility Rules & Security Gates

Only documents that have successfully completed all pre-flight security checks may enter the OCR pipeline:

- **Quarantined Documents:** When `doc.status === 'QUARANTINED'` or malware was detected, `OcrService.processDocument()` throws `DocumentNotEligibleError` (HTTP 403, code: `DOCUMENT_QUARANTINED`). The document payload is quarantined and never loaded into OCR memory.
- **Rejected / Failed / Unscanned Documents:** Documents with `status === 'REJECTED'`, `'FAILED'`, or `'PENDING_SCAN'` are rejected with HTTP 400 (`DOCUMENT_REJECTED`, `DOCUMENT_FAILED`, `DOCUMENT_NOT_SCANNED`).
- **Strict Tenant Fencing:** Requests are fenced by tenant ID derived from verified JWT claims (`req.user.tenantId`). Cross-tenant document processing or retrieval attempts return HTTP 404 (`DOCUMENT_NOT_FOUND`).
- **Resource & Payload Limits:**
  - Maximum payload size: 50 MB.
  - Maximum page count: 50 pages per document.
  - Timeout deadline: 60,000 ms.
- **Log Confidentiality:** Extracted document text and binary buffers are strictly redacted from logs; only structured metrics (`documentId`, `tenantId`, `pageCount`, `wordCount`, `durationMs`) are emitted.

---

## 4. Step 3: OCR Engine Architecture & Options Comparison

### Pluggable Adapter Architecture
Defined `OcrEngineAdapter` interface (`backend/src/services/ocr-engine.interface.ts`):
- `readonly name: string`
- `readonly version: string`
- `readonly isMock: boolean`
- `isAvailable(): Promise<boolean>`
- `process(input: OcrProcessInput): Promise<NormalizedOcrResult>`

### Engine Selection & Comparison

| Engine Option | Pros | Cons | Decision / Role |
|:---|:---|:---|:---|
| **Tesseract CLI v5.5.0 + Poppler pdftoppm** | Installed on host machine; produces genuine word/line bounding boxes, real confidence ratings, native 300 DPI rasterization via `pdftoppm`. | Requires system binaries; slower on large multi-page scans without GPU. | **Selected as Primary Production Engine** (`TesseractCliAdapter`). |
| **Synthetic Mock OCR Adapter** | Zero external dependencies; instant execution; deterministic geometry; configurable error & timeout modes. | Synthetic tokens for test runs. | **Selected as Testing Adapter** (`SyntheticMockOcrAdapter`, explicitly marked `isMock: true`). |
| **Cloud OCR APIs (AWS Textract, Google Document AI)** | High accuracy for cursive handwriting. | Third-party vendor lock-in; recurring cloud costs; requires external API keys. | Deferred to future enterprise connector sprints. |

---

## 5. Step 4: Normalized Geometry & Output Schema

Created versioned schema (`schemaVersion: '1.0.0'`) in `backend/src/models/ocr.models.ts` and `backend/src/utils/geometry-normalizer.ts`:

- **Coordinate System:**
  - Units: `'pixels'` (at 300 DPI rasterization resolution) or `'points'`
  - Origin: `'top_left'`
- **Word Token Schema (`OcrWordToken`):**
  - `id`: Unique word token identifier (e.g. `w-1-12`)
  - `text`: Extracted word text
  - `confidence`: Normalized genuine confidence in range `[0.0000, 1.0000]`
  - `bbox`: 2D bounding box `{ left, top, width, height }`
  - `polygon`: 8-point clockwise polygon `[tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]`
  - `pageNumber`: 1-indexed page reference
- **Line Token Schema (`OcrLineToken`):**
  - Line-level bounding box containing child word tokens and line text
- **Page Geometry (`OcrPageResult`):**
  - `pageNumber`, `width`, `height`, `dpi: 300`, `rotationDegrees: 0`, `confidence`, `lines`, `words`
- **Document Aggregate (`NormalizedOcrResult`):**
  - `ocrResultId`, `documentId`, `tenantId`, `engine`, `status`, `pageCount`, `fullText`, `overallConfidence`, `pages`, `metadata`

---

## 6. Step 5: Persistence Schema & API Endpoints

### 1. Additive PostgreSQL 16 Migration (`006_ocr_geometry_and_pages.sql`)
- Created `document_ocr_results`:
  - Columns: `ocr_id`, `document_id`, `tenant_id`, `engine_name`, `engine_version`, `status`, `total_pages`, `overall_confidence`, `full_text`, `layout_json` (JSONB), `duration_ms`, timestamps.
  - Constraint: `UNIQUE(document_id)`.
- Created `document_pages`:
  - Columns: `page_id`, `document_id`, `tenant_id`, `page_number`, `width`, `height`, `dpi`, `page_text`, `confidence`, `tokens_json` (JSONB).
  - Constraint: `UNIQUE(document_id, page_number)`.

### 2. REST Endpoints Implemented

| Method | Endpoint | Permission | Description |
|:---|:---|:---:|:---|
| `POST` | `/api/v1/documents/:id/process-ocr` | `DOC_EDIT` | Triggers OCR processing on eligible queued document; returns normalized geometry. |
| `GET` | `/api/v1/documents/:id/ocr` | `DOC_VIEW` | Retrieves complete layout JSON and extracted text within tenant isolation boundary. |
| `GET` | `/api/v1/documents/:id/pages/:pageNumber/geometry` | `DOC_VIEW` | Retrieves page-specific geometry (width, height, bounding boxes, word tokens). |

---

## 7. Regression Verification Summary

```text
Test Suites: 15 passed, 15 total
Tests:       160 passed, 160 total
Snapshots:   0 total
Time:        ~8.95 s
```

### Complete Test Inventory

1. `src/services/ocr.service.spec.ts` — **20 passed** (Eligibility checks, geometry normalization, multi-page bounds, low-confidence transitions, corrupt/empty handling, tesseract availability, concurrency guards, failed retry support, idempotency, TSV parsing)
2. `src/controllers/ocr.controller.spec.ts` — **10 passed** (REST routes, RFC 7807 problem details, unauthorized & forbidden checks, 409 conflict, 504 timeout, tenant isolation)
3. `src/utils/file-validator.spec.ts` — **19 passed** (Magic bytes, MIME check, path traversal, Unicode, SHA-256 fixture)
4. `src/services/scanner.service.spec.ts` — **4 passed** (ClamAV daemon, EICAR detection, fail-closed offline handling)
5. `src/services/intake.service.spec.ts` — **14 passed** (Ingestion lifecycle, deduplication, quarantine isolation, storage key generation)
6. `src/controllers/intake.controller.spec.ts` — **13 passed** (HTTP multipart, RFC 7807 responses, tenancy enforcement, RBAC)
7. `src/services/intake.qa.spec.ts` — **15 passed** (Independent QA edge cases: concurrency, cross-tenant isolation, spoofed headers)
8. `src/services/auth.service.spec.ts` — **10 passed** (JWT authentication, session rotation, family revocation, in-memory fallback)
9. `src/services/schema.service.spec.ts` — **24 passed** (Catalog, templates, policy evaluation, deterministic operators, ReDoS defense)
10. `src/controllers/schema.controller.spec.ts` — **9 passed** (Schema API routes, validation, policy creation)
11. `src/controllers/document.controller.spec.ts` — **2 passed** (Document retrieval & list endpoints)
12. `src/middleware/auth.middleware.spec.ts` — **7 passed** (JWT verification, claims extraction, role permissions)
13. `src/middleware/rate-limit.middleware.spec.ts` — **4 passed** (Token bucket rate limiting, HTTP 429 headers)
14. `src/middleware/error.middleware.spec.ts` — **4 passed** (RFC 7807 problem details formatter, 500 error masking)
15. `src/utils/logger.spec.ts` — **5 passed** (Structured JSON logging, PII redaction)

---

## 8. Gate Verdict & Discipline Affirmation

1. **Sprint 5 Status:** ⚠️ **CONDITIONAL PASS**
   - Application code, security controls, OCR adapters, geometry normalizer, unit tests, and full regression tests are **100% verified and passing** (160 tests passed across 15 suites).
   - Mandatory PostgreSQL 16 + pgvector sandbox integration gate remains **BLOCKED** pending sandbox provisioning on port 5434.
   - Comprehensive closure findings documented in [`docs/SPRINT_5_INDEPENDENT_QA_REPORT.md`](../docs/SPRINT_5_INDEPENDENT_QA_REPORT.md).
2. **Next Steps:**
   - **Do NOT begin Sprint 6** until Sprint 5 is reviewed and authorized by the user.
