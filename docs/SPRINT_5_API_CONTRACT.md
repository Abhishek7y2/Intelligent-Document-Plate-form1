# DocuNexa Sprint 5 — OCR and Document Geometry API Contract

**Status:** Approved & Verified (Sprint 5)  
**Base URL:** `/api/v1`  
**Security Standard:** RFC 7807 Problem Details for HTTP APIs  
**Authorization Context:** Bearer JWT required (`req.user.tenantId` derived strictly from verified claims)

---

## 1. Endpoints Overview

| Method | Endpoint | Permission Required | Summary |
|:---|:---|:---|:---|
| `POST` | `/api/v1/documents/:id/process-ocr` | `DOC_EDIT` | Triggers OCR text extraction and geometry layout generation on eligible queued documents |
| `GET` | `/api/v1/documents/:id/ocr` | `DOC_VIEW` | Retrieves complete normalized OCR output including all page tokens and layout JSON |
| `GET` | `/api/v1/documents/:id/pages/:pageNumber/geometry` | `DOC_VIEW` | Retrieves page-specific geometry (dimensions, word tokens, 8-point polygons, bounding boxes) |

---

## 2. POST /api/v1/documents/:id/process-ocr

Executes OCR rasterization, token extraction, and geometry normalization for an eligible document.

### Processing Preconditions
- The document must belong to the caller's tenant (`req.user.tenantId === doc.tenantId`).
- The document must have passed pre-flight security checks (`doc.status === 'QUEUED'`).
- Quarantined (`status === 'QUARANTINED'`), rejected, or unscanned documents are rejected with HTTP 403 or 400.

### Request Body (Optional)
```json
{
  "engineType": "auto",       // "auto" | "tesseract" | "mock"
  "maxPages": 50,             // Maximum pages to rasterize (1-50, default: 50)
  "timeoutMs": 60000          // Engine timeout in milliseconds (default: 60000)
}
```

### Responses

#### 200 OK (OCR Processing Succeeded)
```json
{
  "status": "SUCCESS",
  "message": "OCR extraction and geometry normalization completed successfully.",
  "data": {
    "schemaVersion": "1.0.0",
    "ocrResultId": "OCR-1791556530000-48291",
    "documentId": "DOC-VALID-01",
    "tenantId": "TNT-CORP-01",
    "engine": {
      "name": "tesseract-cli",
      "version": "5.5.0",
      "language": "eng",
      "isMock": false
    },
    "coordinateSystem": {
      "units": "pixels",
      "origin": "top_left",
      "dpi": 300
    },
    "status": "SUCCESS",
    "pageCount": 1,
    "fullText": "TAX INVOICE\nAcme Global Supplies Corp.\nInvoice No: INV-2026-9941\nTotal Due: $14,500.00",
    "overallConfidence": 0.985,
    "pages": [
      {
        "pageNumber": 1,
        "width": 2550,
        "height": 3300,
        "dpi": 300,
        "rotationDegrees": 0,
        "confidence": 0.985,
        "text": "TAX INVOICE\nAcme Global Supplies Corp.\nInvoice No: INV-2026-9941\nTotal Due: $14,500.00",
        "lines": [
          {
            "id": "line-1-1",
            "text": "TAX INVOICE",
            "confidence": 0.985,
            "bbox": { "left": 100, "top": 120, "width": 400, "height": 45 },
            "polygon": [100, 120, 500, 120, 500, 165, 100, 165],
            "pageNumber": 1,
            "words": [
              {
                "id": "w-1-1",
                "text": "TAX",
                "confidence": 0.985,
                "bbox": { "left": 100, "top": 120, "width": 190, "height": 45 },
                "polygon": [100, 120, 290, 120, 290, 165, 100, 165],
                "pageNumber": 1
              },
              {
                "id": "w-1-2",
                "text": "INVOICE",
                "confidence": 0.985,
                "bbox": { "left": 300, "top": 120, "width": 200, "height": 45 },
                "polygon": [300, 120, 500, 120, 500, 165, 300, 165],
                "pageNumber": 1
              }
            ]
          }
        ]
      }
    ],
    "metadata": {
      "durationMs": 1420,
      "processedAt": "2026-10-09T18:45:00.000Z",
      "fileSizeBytes": 204850,
      "mimeType": "application/pdf"
    }
  }
}
```

#### 403 Forbidden (Document is Quarantined)
```json
{
  "type": "https://api.docunexa.enterprise/errors/DOCUMENT_QUARANTINED",
  "title": "Document 'DOC-MALWARE-99' is quarantined due to malware and is prohibited from entering the processing pipeline.",
  "status": 403,
  "instance": "/api/v1/documents/DOC-MALWARE-99/process-ocr"
}
```

#### 404 Not Found (Document Not Found in Tenant)
```json
{
  "type": "https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND",
  "title": "Document 'DOC-NONEXISTENT' not found within tenant boundary.",
  "status": 404,
  "instance": "/api/v1/documents/DOC-NONEXISTENT/process-ocr"
}
```

---

## 3. GET /api/v1/documents/:id/ocr

Fetches the complete normalized layout JSON and token graph for a processed document.

### Responses

#### 200 OK
Returns `{ "status": "SUCCESS", "data": <NormalizedOcrResult> }`.

#### 404 Not Found
```json
{
  "type": "https://api.docunexa.enterprise/errors/OCR_NOT_FOUND",
  "title": "OCR results not found for document 'DOC-UNPROCESSED'.",
  "status": 404,
  "instance": "/api/v1/documents/DOC-UNPROCESSED/ocr"
}
```

---

## 4. GET /api/v1/documents/:id/pages/:pageNumber/geometry

Fetches page-specific layout dimensions, words, and 8-point polygons for frontend review canvas rendering.

### Responses

#### 200 OK
```json
{
  "status": "SUCCESS",
  "data": {
    "documentId": "DOC-VALID-01",
    "tenantId": "TNT-CORP-01",
    "pageNumber": 1,
    "width": 2550,
    "height": 3300,
    "dpi": 300,
    "rotationDegrees": 0,
    "confidence": 0.985,
    "text": "TAX INVOICE...",
    "words": [
      {
        "id": "w-1-1",
        "text": "TAX",
        "confidence": 0.985,
        "bbox": { "left": 100, "top": 120, "width": 190, "height": 45 },
        "polygon": [100, 120, 290, 120, 290, 165, 100, 165],
        "pageNumber": 1
      }
    ],
    "lines": [...]
  }
}
```

#### 400 Bad Request (Invalid Page Number)
```json
{
  "type": "https://api.docunexa.enterprise/errors/INVALID_PAGE_NUMBER",
  "title": "Page number must be a positive 1-indexed integer.",
  "status": 400,
  "instance": "/api/v1/documents/DOC-VALID-01/pages/0/geometry"
}
```
