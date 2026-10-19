# DocuNexa Known Issues & Technical Debt Register

**Auditor:** Senior Software Architect & QA Lead  
**Scope:** Frontend Codebase & Node.js Backend Specifications  

---

## 1. ⚠️ Technical Debt & Mocking Dependencies

| ID | Module / Component | Category | Finding Description | Severity | Remediation Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TD-001** | `api-services.ts` | Service Layer | Services rely on `Mock*Service` returning in-memory `of()` observables. | **HIGH** | Build `Http*Service` classes communicating with Node.js endpoints. |
| **TD-002** | `auth.guard.ts` | Security | Auth Guard checks `sessionStorage` token presence but lacks token expiry decoding. | **MEDIUM** | Integrate JWT decode logic & automatic refresh interceptor. |
| **TD-003** | `review-workbench.ts` | UI Engine | PDF canvas uses bounding box layout containers rather than binary `pdfjs-dist` canvas rendering. | **MEDIUM** | Embed `pdfjs-dist` viewer with dynamic SVG polygon overlay layer. |
| **TD-004** | `reports.ts` | Export Engine | CSV export generates client-side Blob rather than downloading server-signed stream. | **LOW** | Connect to `GET /api/v1/reports/export` with SHA-256 header verification. |
