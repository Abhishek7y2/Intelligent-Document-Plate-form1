# DocuNexa Sprint 4 — Test Execution & Quality Assurance Results

**Date:** 2026-10-09  
**Test Framework:** Jest 29.7.0 with ts-jest 29.1.5  
**Runtime:** Node.js 22 LTS on Windows  
**Scope:** File Validation, Malware Scanning Adapters, Intake Lifecycle, and REST Controller Endpoints  

---

## 1. Test Execution Summary

| Test Suite File | Type | Tests Planned | Tests Passed | Tests Failed | Status |
|:---|:---|:---|:---|:---|:---|
| `src/utils/file-validator.spec.ts` | Unit / Security | 17 | 17 | 0 | **PASS** |
| `src/services/scanner.service.spec.ts` | Unit / Adapter | 9 | 9 | 0 | **PASS** |
| `src/services/intake.service.spec.ts` | Mocked Integration | 9 | 9 | 0 | **PASS** |
| `src/controllers/intake.controller.spec.ts` | Mocked Controller | 11 | 11 | 0 | **PASS** |
| **Total Sprint 4 Test Count** | — | **46** | **46** | **0** | **100% PASS** |

### Execution Command & Output
```bash
$ npx jest src/utils/file-validator.spec.ts src/services/scanner.service.spec.ts src/services/intake.service.spec.ts src/controllers/intake.controller.spec.ts
PASS src/utils/file-validator.spec.ts (8.588 s)
PASS src/services/scanner.service.spec.ts (6.681 s)
PASS src/services/intake.service.spec.ts (8.864 s)
PASS src/controllers/intake.controller.spec.ts (8.623 s)

Test Suites: 4 passed, 4 total
Tests:       46 passed, 46 total
Snapshots:   0 total
Time:        10.043 s
Ran all test suites.
Exit Code:   0
```

---

## 2. Test Cases Breakdown

### A. File Validation & Magic Bytes (`file-validator.spec.ts` — 17 Tests)
- `detectMimeFromBuffer()`:
  -  Accurately identifies PDF magic bytes (`%PDF-`)
  -  Accurately identifies PNG magic bytes (`\x89PNG\r\n\x1a\n`)
  -  Accurately identifies JPEG magic bytes (`\xFF\xD8\xFF`)
  -  Accurately identifies TIFF magic bytes (Little-Endian `II*\x00` and Big-Endian `MM\x00*`)
  -  Accurately identifies DOCX magic bytes (`PK\x03\x04` Zip header)
  -  Rejects unsupported magic bytes (Windows PE `MZ` header)
  -  Handles buffers shorter than 4 bytes gracefully (returns `null`)
- `validateUploadFile()`:
  -  Accepts valid PDF matching declared MIME type
  -  Rejects empty files (0 bytes) with `Uploaded file is empty (0 bytes).`
  -  Rejects oversized files (>50 MB limit)
  -  Rejects MIME/signature mismatches (PNG file disguised as `application/pdf`)
  -  Rejects executable files disguised as PDF
  -  Rejects undeclared / unapproved MIME types
- Path Traversal & Sanitization:
  -  Strips directory traversal sequences (`../../etc/passwd`, `..\..\windows\system32\cmd.exe`)
  -  Strips null bytes (`\0`) and unsafe command shell characters
  -  Falls back safely to `document.bin` for blank or root-only strings
  -  Generates server-controlled tenant-isolated storage keys (`tenants/{tenantId}/raw/{docId}.{ext}`)
- SHA-256 Calculation:
  -  Deterministically computes 64-character hex hash
  -  Produces unique hashes for different payloads

### B. Malware Scanner Adapter & Fail-Closed Boundary (`scanner.service.spec.ts` — 9 Tests)
- `MockMalwareScanner`:
  -  Reports clean in heuristic mode for regular clean buffer
  -  Detects EICAR test string and flags as infected
  -  Flags infected files with suspicious filename keywords
  -  Reports clean in `always_clean` mode
  -  Reports threat in `always_infected` mode
  -  Throws `ScannerUnavailableError` when mode is `fail_offline`
- `ClamAvScanner` (Fail-Closed Boundary):
  -  Detects EICAR signature in pre-filter locally without socket call
  -  Throws `ScannerUnavailableError` (HTTP 503) when daemon is offline rather than claiming clean
  -  Produces RFC 7807 compatible error properties (`statusCode: 503`, `code: 'SCANNER_UNAVAILABLE'`)

### C. IntakeService Secure Lifecycle (`intake.service.spec.ts` — 9 Tests)
- Clean Document Ingestion:
  -  Successfully ingests clean PDF, transitions status to `QUEUED`, stage to `INGESTION_COMPLETE`
  -  Sanitizes filename and prevents directory traversal
- Validation Rejections:
  -  Throws `IntakeValidationError` (HTTP 422) on empty buffer
  -  Throws `IntakeValidationError` (HTTP 422) on magic byte mismatch
- Malware Quarantine Workflow:
  -  Isolates infected file to quarantine path (`tenants/{tenantId}/quarantine/...`), marks status `QUARANTINED`, throws `MalwareDetectedError`
  -  Fails closed when scanner is offline, preventing raw storage write
- Deduplication & Multi-Tenancy:
  -  Rejects duplicate upload with matching hash within the same tenant (`DuplicateDocumentError`, HTTP 409)
  -  Allows upload of identical document hash in a different tenant (tenant isolation)
  -  Prevents cross-tenant document metadata access in `getDocument()`

### D. Intake Controller Endpoints (`intake.controller.spec.ts` — 11 Tests)
- `POST /api/v1/documents/upload`:
  -  Returns HTTP 400 `MISSING_FILE` when multipart file field is omitted
  -  Returns HTTP 401 `UNAUTHORIZED` when JWT tenant context is absent
  -  Returns HTTP 201 `SUCCESS` on valid clean upload with document payload
  -  Returns HTTP 422 `FILE_VALIDATION_FAILED` (RFC 7807) on magic byte mismatch
  -  Returns HTTP 422 `MALWARE_DETECTED` (RFC 7807) with `quarantined: true` on virus signature
  -  Returns HTTP 409 `DUPLICATE_DOCUMENT` (RFC 7807) on intra-tenant duplicate hash
  -  Returns HTTP 503 `SCANNER_UNAVAILABLE` (RFC 7807) when scanner daemon is offline
- `GET /api/v1/documents/:id`:
  -  Returns HTTP 404 `DOCUMENT_NOT_FOUND` for non-existent documents
  -  Returns HTTP 404 `DOCUMENT_NOT_FOUND` when attempting to access another tenant's document
  -  Returns HTTP 200 with document details when document belongs to authenticated tenant

---

## 3. Build & Static Analysis Results

| Tool | Target | Result | Exit Code |
|:---|:---|:---|:---|
| TypeScript (`tsc`) | `backend/tsconfig.json` | 0 errors, successful emit to `dist/` | **0** |
| ESLint | `backend/src` | 0 errors | **0** |

---

## 4. Environment Classification & Limitations

- **Unit & Mocked Integration Tests:** **FULL PASS (46/46 passing)**.
- **Live PostgreSQL 16 Sandbox Execution:** **BLOCKED** as authorized by governance constraints.
  - Active database runs PostgreSQL 12.12 on port 5433 with existing 49-table schema.
  - As instructed, migrations 001–005 were **NOT** executed against the active PostgreSQL 12.12 database.
  - Additive migration `005_document_intake_and_quarantine.sql` has been verified by static DDL inspection and is ready to run upon PostgreSQL 16 sandbox provisioning.
