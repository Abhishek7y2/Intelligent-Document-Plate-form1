# DocuNexa Sprint 3 — API Contract Specification

## Base URL
All Sprint 3 APIs are hosted under prefix: `/api/v1`

---

## Authentication & Headers
- `Authorization: Bearer <JWT_ACCESS_TOKEN>` (**Mandatory**: Tenant identity is strictly derived from the cryptographically verified JWT claims `req.user.tenantId`).
- `X-Tenant-Id: <UUID>` (Optional: Validated against verified JWT token claim. Any mismatch triggers 403 Forbidden).
- `X-Correlation-Id: <UUID>` (Optional: Propagated in request lifecycle and error problem details).
- `Content-Type: application/json`

---

## Endpoints Summary

### 1. Document Types Catalog

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/document-types` | List available document types (global + caller's tenant) | `schema:view` |
| `GET` | `/document-types/:id` | Get document type details by ID | `schema:view` |
| `POST` | `/document-types` | Create a new tenant document type | `schema:manage` |
| `PUT` | `/document-types/:id` | Update an existing document type | `schema:manage` |

### 2. Extraction Templates & Field Schemas

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/document-types/:typeId/templates` | List extraction templates for a document type | `schema:view` |
| `GET` | `/extraction-templates?documentTypeId=...` | Alias: List extraction templates via query parameter | `schema:view` |
| `GET` | `/document-types/:typeId/templates/:version` | Get extraction template by version | `schema:view` |
| `POST` | `/document-types/:typeId/templates` | Create a draft template version | `schema:manage` |
| `POST` | `/document-types/:typeId/templates/:version/publish` | Atomically publish & activate template version | `schema:manage` |
| `POST` | `/document-types/:typeId/templates/validate` | Dry-run validation of field schemas & ReDoS checks | `schema:view` |

### 3. Processing Policies & Deterministic Evaluator

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/document-types/:typeId/policies` | List processing policies for a document type | `policy:view` |
| `GET` | `/policies?documentTypeId=...` | Alias: List processing policies via query parameter | `policy:view` |
| `GET` | `/policies/:id` | Get processing policy by ID | `policy:view` |
| `POST` | `/document-types/:typeId/policies` | Create draft processing policy | `policy:manage` |
| `POST` | `/policies/:id/publish` | Atomically publish & activate policy version | `policy:manage` |
| `POST` | `/policies/:id/evaluate` | Evaluate policy rules against document payload | `policy:evaluate` |

---

## Error Handling Conventions (RFC 7807)

When validation fails, errors are returned with `application/problem+json` status 400 or 422:

```json
{
  "type": "https://api.docunexa.enterprise/errors/UNPROCESSABLE_ENTITY",
  "title": "Template validation failed.",
  "status": 422,
  "detail": "Dangerous regular expression pattern detected: nested quantifiers may cause catastrophic backtracking (ReDoS).",
  "instance": "/api/v1/document-types/purchase-invoice/templates/validate",
  "errors": [
    "Field index 0 (vulnerable_field): Field contains an invalid or dangerous regular expression pattern."
  ]
}
```

When database persistence fails or is unreachable in production, the API fails closed with status 503:

```json
{
  "type": "https://api.docunexa.enterprise/errors/DATABASE_UNAVAILABLE",
  "title": "Database service unavailable when fetching document types.",
  "status": 503,
  "instance": "/api/v1/document-types"
}
```
