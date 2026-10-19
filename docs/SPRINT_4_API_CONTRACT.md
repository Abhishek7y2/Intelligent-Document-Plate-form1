# DocuNexa Sprint 4 — Secure Document Intake API Contract

**Status:** Approved & Verified (Sprint 4)  
**Base URL:** `/api/v1`  
**Security Standard:** RFC 7807 Problem Details for HTTP APIs  
**Authorization Context:** Bearer JWT required (`req.user.tenantId` derived strictly from verified claims)

---

## 1. Endpoints Overview

| Method | Endpoint | Permission Required | Summary |
|:---|:---|:---|:---|
| `POST` | `/api/v1/documents/upload` | `DOC_UPLOAD` | Multipart document upload with pre-flight magic-byte validation and malware scan |
| `GET` | `/api/v1/documents/:id` | `DOC_VIEW` | Retrieve ingested document metadata within tenant isolation boundary |

---

## 2. POST /api/v1/documents/upload

Uploads a binary document into DocuNexa. Validates file signature, detects malware, isolates threats to quarantine, verifies uniqueness by SHA-256 within the tenant, and stores the object under server-controlled paths.

### Request Headers
- `Authorization`: `Bearer <jwt_token>` (Mandatory)
- `Content-Type`: `multipart/form-data; boundary=...` (Mandatory)
- `X-Correlation-ID`: `<optional_uuid>` (Optional; echoed in errors and audit logs)

### Multipart Form Fields

| Field Name | Type | Required | Description |
|:---|:---|:---|:---|
| `file` | Binary File | **Yes** | Single document file. Must be 1 byte to 50 MB (52,428,800 bytes). |
| `documentType` | String | No | Target document classification (defaults to `purchase-invoice`). |
| `ingestionSource` | String | No | Channel source: `MANUAL_UPLOAD`, `EMAIL_SCAN`, `API_INGEST`, `MOBILE_SCAN` (defaults to `MANUAL_UPLOAD`). |
| `allowDuplicate` | String / Boolean | No | If `"true"`, bypasses intra-tenant SHA-256 deduplication rejection. |

### Allowed File Types & Magic Byte Signatures

| Format | Allowed MIME Types | File Signature (Magic Bytes) |
|:---|:---|:---|
| **PDF** | `application/pdf` | `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`) |
| **PNG** | `image/png` | `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`) |
| **JPEG** | `image/jpeg`, `image/jpg` | `0xFF 0xD8 0xFF` |
| **TIFF** | `image/tiff` | Little-Endian: `II*\x00` (`0x49 0x49 0x2A 0x00`)<br>Big-Endian: `MM\x00*` (`0x4D 0x4D 0x00 0x2A`) |
| **DOCX** | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `PK\x03\x04` (`0x50 0x4B 0x03 0x04`) |

---

### Responses

#### 201 Created (Upload & Scan Succeeded)
```json
{
  "status": "SUCCESS",
  "message": "Document successfully ingested and queued for processing.",
  "data": {
    "documentId": "DOC-1791551292615-18386",
    "fileName": "vendor_tax_invoice.pdf",
    "sha256Hash": "eae3f4359dea6eec557ebe06e771ceb859d373a4bbd8c3874f583871e4f55632",
    "fileSizeBytes": 204850,
    "mimeType": "application/pdf",
    "documentType": "purchase-invoice",
    "status": "QUEUED",
    "stage": "INGESTION_COMPLETE",
    "uploadedAt": "2026-10-09T18:38:12.615Z"
  }
}
```

#### 400 Bad Request (Missing File or Invalid Multipart)
```json
{
  "type": "https://api.docunexa.enterprise/errors/MISSING_FILE",
  "title": "No document file provided in request. Expecting multipart field 'file'.",
  "status": 400,
  "instance": "/api/v1/documents/upload",
  "correlationId": "corr-uuid",
  "timestamp": "2026-10-09T18:38:12.615Z"
}
```

#### 401 Unauthorized (Missing / Invalid Token)
```json
{
  "type": "https://api.docunexa.enterprise/errors/UNAUTHORIZED",
  "title": "Authentication token is missing required user or tenant subject claims.",
  "status": 401,
  "instance": "/api/v1/documents/upload"
}
```

#### 403 Forbidden (Missing DOC_UPLOAD Permission)
```json
{
  "type": "https://api.docunexa.enterprise/errors/FORBIDDEN",
  "title": "Access denied: User does not possess the required permission 'DOC_UPLOAD' to perform this action.",
  "status": 403,
  "instance": "/api/v1/documents/upload"
}
```

#### 409 Conflict (Duplicate SHA-256 within Tenant Scope)
```json
{
  "type": "https://api.docunexa.enterprise/errors/DUPLICATE_DOCUMENT",
  "title": "A document with matching SHA-256 hash 'eae3f4359dea6eec557ebe06e771ceb859d373a4bbd8c3874f583871e4f55632' already exists in this tenant (ID: DOC-1791551292615-18386).",
  "status": 409,
  "existingDocumentId": "DOC-1791551292615-18386",
  "instance": "/api/v1/documents/upload"
}
```

#### 413 Payload Too Large (File > 50 MB)
```json
{
  "type": "https://api.docunexa.enterprise/errors/PAYLOAD_TOO_LARGE",
  "title": "Uploaded file exceeds the maximum allowed limit of 50 MB.",
  "status": 413,
  "instance": "/api/v1/documents/upload"
}
```

#### 422 Unprocessable Entity (File Signature / Magic Byte Mismatch or Empty File)
```json
{
  "type": "https://api.docunexa.enterprise/errors/FILE_VALIDATION_FAILED",
  "title": "File signature (magic bytes) does not match any approved format (PDF, PNG, JPEG, TIFF, DOCX).",
  "status": 422,
  "instance": "/api/v1/documents/upload"
}
```

#### 422 Unprocessable Entity (Malware Detected — Quarantined)
```json
{
  "type": "https://api.docunexa.enterprise/errors/MALWARE_DETECTED",
  "title": "Malware detected: file rejected with threat signature 'Win.Test.EICAR_HDB-1'. File quarantined.",
  "status": 422,
  "threat": "Win.Test.EICAR_HDB-1",
  "quarantined": true,
  "instance": "/api/v1/documents/upload"
}
```

#### 503 Service Unavailable (Malware Scanner Offline — Fail-Closed Boundary)
```json
{
  "type": "https://api.docunexa.enterprise/errors/SCANNER_UNAVAILABLE",
  "title": "Malware scanner service is unavailable. Intake operates under fail-closed security policy.",
  "status": 503,
  "instance": "/api/v1/documents/upload"
}
```

---

## 3. GET /api/v1/documents/:id

Fetches document metadata by unique identifier, strictly fenced by the caller's JWT tenant ID.

### Request Headers
- `Authorization`: `Bearer <jwt_token>` (Mandatory)

### Responses

#### 200 OK
```json
{
  "data": {
    "documentId": "DOC-1791551292615-18386",
    "tenantId": "TNT-CORP-01",
    "fileName": "vendor_tax_invoice.pdf",
    "storagePath": "tenants/TNT-CORP-01/raw/DOC-1791551292615-18386.pdf",
    "fileSizeBytes": 204850,
    "mimeType": "application/pdf",
    "sha256Hash": "eae3f4359dea6eec557ebe06e771ceb859d373a4bbd8c3874f583871e4f55632",
    "documentType": "purchase-invoice",
    "status": "QUEUED",
    "stage": "INGESTION_COMPLETE",
    "confidenceScore": null,
    "slaStatus": "ON_TRACK",
    "ingestionSource": "MANUAL_UPLOAD",
    "uploadedAt": "2026-10-09T18:38:12.615Z"
  }
}
```

#### 404 Not Found (Cross-Tenant Access or Non-Existent Document)
```json
{
  "type": "https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND",
  "title": "Document 'DOC-1791551292615-18386' does not exist or is not accessible within your tenant scope.",
  "status": 404,
  "instance": "/api/v1/documents/DOC-1791551292615-18386"
}
```
