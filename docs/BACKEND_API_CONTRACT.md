# DocuNexa Enterprise Backend API Contract Specification
**Version:** 1.0.0  
**Base URL:** `https://api.docunexa.enterprise/v1`  
**Protocol:** HTTPS / REST / WebSockets (`wss://api.docunexa.enterprise/ws`)  
**Auth Strategy:** OAuth 2.0 / JWT Bearer Tokens with Dynamic RBAC Scopes  

---

## 1. Authentication & Security Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Description:** Authenticates enterprise user against LDAP/SSO or internal RBAC.
- **Request Body:**
  ```json
  {
    "email": "analyst@docunexa.io",
    "password": "<your-test-password>",
    "mfaCode": "482910"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d8f921a9-3b...",
    "expiresIn": 28800,
    "user": {
      "id": "USR-88210",
      "name": "Jane Doe",
      "email": "analyst@docunexa.io",
      "role": "Reviewer",
      "tenantId": "TNT-CORP-01",
      "permissions": ["DOC_VIEW", "DOC_EDIT", "DOC_VERIFY", "REPORT_GENERATE"]
    }
  }
  ```

---

## 2. Document Ingestion & Processing (`/api/v1/documents`)

### `POST /api/v1/documents/upload` (BRD: FR-001, FR-002)
- **Description:** Multi-part binary file upload supporting PDF, TIFF, PNG, DOCX with auto-hashing (SHA-256) and malware scan.
- **Headers:** `Content-Type: multipart/form-data`
- **Form Data:**
  - `file`: Binary file stream
  - `documentType`: `INVOICE` | `LOAN_AGREEMENT` | `CLAIM_FORM` | `ID_CARD` | `AUTO`
  - `ingestionSource`: `S3_WATCHER` | `EMAIL_INGEST` | `MANUAL_UPLOAD` | `API_CONNECTOR`
- **Response `201 Created`:**
  ```json
  {
    "documentId": "DOC-10247",
    "fileName": "Q3_Vendor_Invoice_984.pdf",
    "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "fileSizeBytes": 451920,
    "status": "QUEUED",
    "stage": "OCR_EXTRACTION",
    "estimatedProcessTimeMs": 1400
  }
  ```

### `GET /api/v1/documents` (BRD: FR-003, FR-004)
- **Description:** Paginated document queue listing with multi-parameter filtering, sorting, and SLA status.
- **Query Parameters:** `page`, `pageSize`, `status`, `search`, `docType`, `slaBucket`, `startDate`, `endDate`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "DOC-10247",
        "title": "Master Service Agreement - Vendor Corp",
        "docType": "LOAN_AGREEMENT",
        "status": "NEEDS_REVIEW",
        "confidence": 0.82,
        "slaStatus": "WARNING",
        "source": "EMAIL_INGEST",
        "pages": 14,
        "uploadedAt": "2026-10-09T08:30:00Z"
      }
    ],
    "pagination": { "totalItems": 1284, "page": 1, "pageSize": 20, "totalPages": 65 }
  }
  ```

### `GET /api/v1/documents/{id}/detail` (BRD: FR-005, FR-006)
- **Description:** Fetches complete layout metadata, OCR page polygons, extracted entities, confidence scores, and rule validation state for Review Workbench.
- **Response `200 OK`:**
  ```json
  {
    "documentId": "DOC-10247",
    "fileName": "MSA_Vendor_Corp.pdf",
    "pdfUrl": "https://storage.docunexa.io/docs/DOC-10247.pdf",
    "overallConfidence": 0.82,
    "pages": [
      {
        "pageNumber": 1,
        "width": 612,
        "height": 792,
        "ocrBoxes": [
          { "id": "BOX-1", "bbox": [50, 100, 200, 30], "text": "INVOICE #9842" }
        ]
      }
    ],
    "extractedData": {
      "vendor_name": { "value": "Acme Global Solutions", "confidence": 0.98, "bbox": [50, 100, 200, 30], "isVerified": true },
      "total_amount": { "value": "$14,500.00", "confidence": 0.64, "bbox": [300, 450, 100, 25], "isVerified": false, "ruleFlag": "SLA_THRESHOLD_EXCEEDED" }
    }
  }
  ```

---

## 3. Human-in-the-Loop & Approval Pipeline (`/api/v1/review`)

### `POST /api/v1/documents/{id}/verify-field` (BRD: FR-007, FR-008)
- **Description:** Submits reviewer correction for an extracted field value.
- **Request Body:**
  ```json
  {
    "fieldKey": "total_amount",
    "correctedValue": "$14,500.00",
    "overrideReason": "OCR misread dollar sign as digit 8",
    "reviewerId": "USR-88210"
  }
  ```

### `POST /api/v1/documents/{id}/submit-approval` (BRD: FR-009, FR-010)
- **Description:** Triggers final validation, cryptographically signs audit log, and routes data to downstream ERP/CRM connectors.
- **Request Body:**
  ```json
  {
    "action": "APPROVE", // "APPROVE" | "REJECT" | "ESCALATE"
    "comments": "All line items verified against ERP Purchase Order #PO-9941.",
    "escalationUser": null
  }
  ```

---

## 4. Analytics & Governance Reporting (`/api/v1/reports`)

### `GET /api/v1/reports/telemetry-kpis` (BRD: FR-011, FR-012)
- **Description:** Real-time metrics for Dashboard and Executive Governance Center.
- **Response `200 OK`:**
  ```json
  {
    "totalProcessedToday": 14280,
    "stpRate": 89.4,
    "avgConfidenceScore": 94.2,
    "activeSlaBreaches": 3,
    "costSavingsUsd": 128450.00
  }
  ```

### `GET /api/v1/reports/export` (BRD: FR-013)
- **Description:** Generates an enterprise-compliant, cryptographically sealed CSV or PDF report.
- **Query Parameters:** `format` (`csv`|`pdf`), `type` (`audit`|`stp`|`exceptions`|`sla`)
- **Headers Response:** `Content-Disposition: attachment; filename="DocuNexa_Audit_Report_20261009.csv"`
