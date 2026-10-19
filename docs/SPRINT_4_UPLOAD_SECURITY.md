# DocuNexa Sprint 4 — Upload Security & Quarantine Architecture

**Date:** 2026-10-09  
**Version:** 1.0  
**Scope:** Pre-flight Validation, Magic Bytes Inspection, Quarantine Sandboxing, Fail-Closed Malware Scanning, and Path Traversal Defense  

---

## 1. Threat Model & Security Posture

The intake endpoint (`POST /api/v1/documents/upload`) is the primary public/external ingress for DocuNexa. Untrusted users upload raw binary files that could contain exploits, trojans, ransomware, path traversal sequences, or spoofed file extensions.

To achieve enterprise defense-in-depth, DocuNexa enforces 7 security layers:

```
[Untrusted Client Upload]
         │
         ▼
[Layer 1: JWT Authentication & RBAC] ──(Requires 'DOC_UPLOAD'; rejects anon/auditors)
         │
         ▼
[Layer 2: Size Ceiling Protection] ──(50 MB hard ceiling enforced in memory stream)
         │
         ▼
[Layer 3: Magic Bytes & Extension Check] ──(Rejects executables, scripts, spoofed headers)
         │
         ▼
[Layer 4: Path Traversal & Filename Sanitizer] ──(Strips ../, null bytes, shell characters)
         │
         ▼
[Layer 5: Pre-Flight Malware Scanner] ──(ClamAV INSTREAM or Heuristic filter)
   ├── Malware Detected? ──► [Layer 6A: Quarantine Isolation] (Status: QUARANTINED, isolated key)
   └── Scanner Offline?   ──► [Layer 6B: Fail-Closed Boundary] (Status: 503 SERVICE UNAVAILABLE)
         │ (Clean)
         ▼
[Layer 7: Server-Controlled Storage Fencing] ──(Key: tenants/{tenantId}/raw/{docId}.{ext})
         │
         ▼
[Document Staged for OCR/Processing] (Status: QUEUED)
```

---

## 2. Layer 1: Strict Tenant Identity Derivation

- **Anti-Spoofing Rule:** `tenantId` is **never** extracted from HTTP request headers (e.g. `X-Tenant-ID`), request query strings, or multipart form bodies.
- **Enforcement:** Derived exclusively from the cryptographically verified JWT claims (`req.user.tenantId`) produced by `authenticateJwt` and verified by `enforceTenantIsolation`.
- **RBAC:** Upload requests require the `DOC_UPLOAD` permission. Admin, Reviewer, and Analyst roles possess this permission; Auditor roles are denied with HTTP 403.

---

## 3. Layer 2: Memory & Size Protection

- **Buffering Ceiling:** Hard limit of **50 MB (52,428,800 bytes)** configured in Multer memory storage.
- **Empty File Protection:** Uploads of 0 bytes are rejected before hashing or scanner submission.
- **Denial of Service Prevention:** Streaming limits prevent heap exhaustion from unbounded multipart streaming.

---

## 4. Layer 3: File Signature (Magic Bytes) Verification

Client-supplied `Content-Type` headers and file extensions are fundamentally untrusted. DocuNexa validates binary headers against known magic bytes:

| File Format | Allowed MIME Type | Magic Bytes Signature (Hex) |
|:---|:---|:---|
| **PDF** | `application/pdf` | `25 50 44 46 2D` (`%PDF-`) |
| **PNG** | `image/png` | `89 50 4E 47 0D 0A 1A 0A` |
| **JPEG** | `image/jpeg` | `FF D8 FF` |
| **TIFF (Little Endian)** | `image/tiff` | `49 49 2A 00` (`II*\x00`) |
| **TIFF (Big Endian)** | `image/tiff` | `4D 4D 00 2A` (`MM\x00*`) |
| **DOCX** | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `50 4B 03 04` (`PK\x03\x04` - Zip Container) |

### Validation Matrix
1. If file buffer signature does not match any entry in the allowlist $\rightarrow$ **HTTP 422 `FILE_VALIDATION_FAILED`**.
2. If detected signature does not match declared MIME type $\rightarrow$ **HTTP 422 `FILE_VALIDATION_FAILED`** (anti-disguise protection).
3. Executable headers (e.g., Windows PE `MZ` `0x4D 0x5A`) are immediately rejected.

---

## 5. Layer 4: Filename Sanitization & Path Traversal Immunity

User filenames can contain malicious sequences designed to escape storage sandboxes (`../../etc/passwd` or `..\..\Windows\System32\cmd.exe`), null bytes (`exploit.pdf\0.exe`), or special command separators (`; & | \`):

1. **Path Base Extraction:** `path.basename(originalName.replace(/\\/g, '/'))` strips all POSIX and Windows directories.
2. **Control Character Stripping:** `replace(/[\x00-\x1F\x7F]/g, '')` eliminates null bytes and non-printable bytes.
3. **Leading Dot Removal:** `replace(/^\.+/, '')` removes hidden file indicators.
4. **Alphanumeric Normalization:** Only alphanumeric characters, hyphens, underscores, and dots are preserved (`[^a-zA-Z0-9._-]` $\rightarrow$ `_`).
5. **Deterministic Storage Keys:** Storage paths are completely server-generated:
   $$\text{StorageKey} = \texttt{"tenants/"} + \text{safeTenantId} + \texttt{"/raw/"} + \text{safeDocId} + \texttt{"."} + \text{safeExt}$$
   The user's original filename is never used to construct the filesystem or object store path.

---

## 6. Layer 5 & 6: Fail-Closed Malware Scanning & Quarantine Sandboxing

### A. The Fail-Closed Principle
DocuNexa strictly implements the **Fail-Closed Security Standard**:
- A document is **never** declared clean or queued for processing simply because the scanner service is offline, timed out, or unconfigured.
- If the ClamAV daemon is unreachable, the system raises a `ScannerUnavailableError` (HTTP 503 `SCANNER_UNAVAILABLE`), aborts ingestion, and stores **no** clean documents.

### B. ClamAV TCP INSTREAM Integration
- Uses standard ClamAV `zINSTREAM\0` protocol over TCP (port 3310).
- Streams buffer in 2048-byte chunks with length prefixes.
- Pre-filters EICAR test signatures (`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`) locally.

### C. Quarantine Sandboxing
If malware is detected:
1. The payload is **never** stored in the `raw/` document directory.
2. The payload is isolated in a sandboxed quarantine path:
   $$\text{QuarantineKey} = \texttt{"tenants/"} + \text{safeTenantId} + \texttt{"/quarantine/"} + \text{docId} + \texttt{"."} + \text{safeExt}$$
3. The database record is tagged with `status: 'QUARANTINED'` and `stage: 'QUARANTINE_ISOLATED'`.
4. Downstream processing pipelines (OCR, classification, extraction) reject any document not in `QUEUED` status.
5. An audit warning event is emitted with the identified threat signature (`threatName`).
6. The client receives HTTP 422 `MALWARE_DETECTED` with `{ quarantined: true }`.

---

## 7. Layer 7: Intra-Tenant Deduplication

- Every upload computes a deterministic **SHA-256 hash** of the raw buffer.
- Documents within the **same tenant** sharing an identical SHA-256 hash are rejected with **HTTP 409 `DUPLICATE_DOCUMENT`** unless `allowDuplicate: true` is explicitly supplied.
- Documents with identical SHA-256 hashes across **different tenants** are permitted, preserving strict tenant data isolation.

---

## 8. Audit Logging & PII Protection

DocuNexa structured logging adheres to strict confidentiality rules:
- **Zero Document Content Logging:** Binary buffers and raw document streams are never logged to console or disk logs.
- **Zero Secret Exposure:** Passwords, JWT secrets, authorization tokens, and API keys are redacted.
- **Audit Details:** Logs record only `tenantId`, `userId`, `documentId`, `fileName`, `fileSizeBytes`, `sha256Hash`, and `status`.
