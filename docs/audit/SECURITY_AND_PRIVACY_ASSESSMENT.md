# DocuNexa — Security and Privacy Assessment

**Document Type:** Security and Privacy Assessment  
**Version:** 1.0 — Baselined  
**Audit Standard:** *Whole Application Evaluation PRD* (Workstream D) & OWASP Top 10  
**Date:** 13 October 2026  
**Auditor Roles:** Principal Application Security Architect, Compliance Officer  

---

## 1. Threat Modeling & Multi-Tenant Fencing

### 1.1 Tenant Isolation Architecture
Multi-tenancy in DocuNexa operates under a zero-trust model:
* **The `X-Tenant-ID` header is never trusted without cryptographic authentication.**
* [`enforceTenantIsolation`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/middleware/auth.middleware.ts#L100) rejects any request where `clientSuppliedTenant !== req.user.tenantId` with `HTTP 403 CROSS_TENANT_FORBIDDEN`.
* All database queries filter explicitly on `req.user.tenantId` extracted from the verified JWT payload.
* Cross-tenant query attempts return 0 results or are blocked with 403 Forbidden.

### 1.2 Separation of Duties (SoD)
* In [`approval.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/approval.service.ts), an approver cannot approve a document if they were the uploader or the verifying reviewer. Violations throw `403 SOD_VIOLATION`.

---

## 2. Authentication, JWT & Session Lifecycle

1. **Token Storage & Transmission:**
   * Browser clients store access tokens in `localStorage` / `sessionStorage`.
   * Outgoing requests decorate headers with `Authorization: Bearer <token>`.
2. **Token Expiry & Interceptor Behavior:**
   * Expired tokens (`HTTP 401 TOKEN_EXPIRED`) trigger [`authHttpInterceptor`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/document-intelligence-ui/src/app/core/api/http-interceptor.ts#L48), which executes `authService.logout()`, invalidates browser storage, and navigates to `/login`.
3. **Correlation ID Isolation:**
   * `X-Correlation-ID` headers are injected solely for distributed tracing and Winston logging. They are never evaluated for authorization.
4. **Rate Limiting & Brute-Force Defense:**
   * `loginRateLimiter` restricts login attempts to 5 per minute per IP address, preventing credential-stuffing attacks.

---

## 3. Server-Side Rendering (SSR) Data Isolation

* Angular SSR uses `isPlatformBrowser(platformId)`.
* In server-side prerendering or SSR handling, `getStoredUser()` returns `null`.
* Unauthenticated requests to protected routes redirect to `/login`.
* Zero user tokens, tenant records, or session states are rendered into static HTML assets.

---

## 4. Privacy, Masking & Cryptographic Erasure

1. **PII Masking on Exports:**
   * `export.service.ts` masks sensitive fields (such as phone numbers, bank accounts, and tax IDs) based on user permissions (`REPORT_GENERATE`).
2. **Citation Click-Time Authorization:**
   * Q&A citation clicks re-validate tenant boundaries and caller permissions at click time, preventing unauthorized access to document snippets.
3. **Cryptographic Purge Proof:**
   * Expired documents subject to secure purge generate a cryptographic SHA-256 seal stored in an immutable audit ledger.
