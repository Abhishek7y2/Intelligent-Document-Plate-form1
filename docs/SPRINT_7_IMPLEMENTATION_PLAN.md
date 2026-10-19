# DocuNexa Sprint 7 — Review Workbench & Angular Integration Implementation Plan

**Version:** 1.0 — Execution Baseline  
**Date:** 2026-10-12  
**Assigned Roles:** Senior Angular Engineer, Backend Architect, QA Lead, Security Reviewer, Document Workflow Specialist  
**Sprint Objectives:** Implement the backend Review Workbench APIs, reviewer field correction pipeline, workflow state transitions, audit logging, and connect the Angular 19 Review & Review Workbench features via real HTTP services while preserving mock fallbacks.  
**Reference Requirements:** [FR-007](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/04-functional-requirements.md#L50-L55), [FR-008](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/04-functional-requirements.md#L56-L61), [FR-015](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/04-functional-requirements.md#L97-L100)  

---

## 1. Scope & System Boundaries

### In-Scope (Sprint 7 Deliverables)
1. **Backend Review Service & Persistence (`ReviewService`)**:
   - `GET /review/queue`: List documents requiring human triage (`status = 'NEEDS_REVIEW'` or stage in `['HITL_REVIEW_PENDING', 'CLASSIFICATION_TRIAGE']`) scoped to the caller's tenant.
   - `GET /review/:id`: Aggregate document details, classification results, extracted fields, visual OCR page geometry, math reconciliation, and correction history into a unified review payload.
   - `POST /review/:id/fields/:key`: Authorized field correction endpoint. Validates corrected value against schema field rules, updates field status to `edited`, recalculates invoice reconciliation if financial amounts change, and appends an immutable audit log entry.
   - `POST /review/:id/decision`: Reviewer workflow action (`APPROVE` $\rightarrow$ `REVIEWED`, `REJECT` $\rightarrow$ `REJECTED`, `FLAG` $\rightarrow$ `CHANGES_REQUESTED`), updating document status atomically and recording reviewer ID and comments in audit history.
   - `GET /review/:id/audit`: Retrieve document review audit events and correction history.
2. **Database Migration `008_review_workbench_and_audit.sql`**:
   - `review_tasks` table: Stores review task assignment, priority, review status, and SLA tracking.
   - `field_corrections` table: Stores immutable audit history of field edits (`original_value`, `corrected_value`, `reviewer_id`, `reason`, `timestamp`).
   - `review_audit_events` table: Stores lifecycle decisions (`APPROVE`, `REJECT`, `FLAG`) with actor, timestamp, and comments.
3. **Angular 19 Real API Services (`HttpReviewService` & `HttpExtractionService`)**:
   - Implement `HttpReviewService` implementing `IReviewService` using `ApiClient` / `HttpClient`.
   - Implement `HttpExtractionService` implementing `IExtractionService`.
   - Update `app.config.ts` or component providers to support clean injection token binding (`REVIEW_SERVICE_TOKEN`, `EXTRACTION_SERVICE_TOKEN`).
   - Support loading, empty, error, and forbidden states.
   - Support 401 token expiration handling via existing `authHttpInterceptor`.
4. **Verification & Regression Testing**:
   - Backend controller and service unit tests for review queue, review details, field corrections, workflow decisions, and security gates (tenant scoping, 401, 403, 404).
   - Frontend unit tests for `HttpReviewService`, `Review`, and `ReviewWorkbench`.
   - Full backend regression run (preserving all 213 existing tests).
   - TypeScript builds and linters across backend and frontend.

### Out-of-Scope (Strictly Enforced)
- **Sprint 8**: Multi-level financial approvals ($<10k, 10k-50k, >50k), Separation of Duties (SoD) dual-control engine, and ERP publishing connectors.
- **Sprint 9**: Full-text pgvector semantic search and document version redline comparison.
- **Sprint 10**: Grounded Conversational Q&A (RAG).
- **PostgreSQL 12.12 Host**: No migrations or modifications on port 5433.
- **PostgreSQL 16 Live Sandbox**: If port 5434 container is unavailable, live integration remains marked BLOCKED.

---

## 2. Requirements-to-Screen-to-API-to-Test Traceability Matrix

| Requirement | Screen / UI Component | Backend Route & Method | Permission | Verification Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **FR-008** (Review Queue) | `Review` (`/review`) | `GET /review/queue` | `DOC_VIEW` | `review.service.spec.ts`<br>`review.controller.spec.ts`<br>`review.spec.ts` |
| **FR-008** (Review Detail) | `ReviewWorkbench` (`/review/:id`) | `GET /review/:id` | `DOC_VIEW` | `review.service.spec.ts`<br>`review.controller.spec.ts` |
| **FR-008** (Field Correction) | `ReviewWorkbench` (Fields Panel) | `POST /review/:id/fields/:key` | `DOC_EDIT` | `review.service.spec.ts`<br>`review.controller.spec.ts` |
| **FR-008** (Review Decision) | `ReviewWorkbench` (Action Header) | `POST /review/:id/decision` | `DOC_VERIFY` | `review.service.spec.ts`<br>`review.controller.spec.ts` |
| **FR-008** (Audit Trail) | `ReviewWorkbench` (Audit Tab) | `GET /review/:id/audit` | `AUDIT_VIEW` or `DOC_VIEW` | `review.service.spec.ts`<br>`review.controller.spec.ts` |
| **FR-015** (RBAC & Tenant) | Both screens & guards | All `/review/*` routes | Bearer JWT | Cross-tenant test cases in `review.service.spec.ts` |

---

## 3. Implementation Phases

### Phase 1: Database Migration 008 & Domain Models
- Define models in `backend/src/models/review.models.ts`:
  - `ReviewTask`, `ReviewWorkbenchData`, `FieldCorrectionRequest`, `ReviewDecisionRequest`, `ReviewAuditEvent`.
- Author `backend/src/database/migrations/008_review_workbench_and_audit.sql`:
  - Tables: `review_tasks`, `field_corrections`, `review_audit_events`.
  - Additive schema with cascading foreign keys to `documents(document_id)` and `tenants(tenant_id)`.

### Phase 2: Backend Review Service & Controller
- Create `backend/src/services/review.service.ts`:
  - Integrates `IntakeService`, `ClassificationService`, `ExtractionService`, `OcrService`, and `reconcileInvoiceAmounts`.
  - Handles in-memory sandboxing for unit tests and parameterized PostgreSQL queries for production.
- Create `backend/src/controllers/review.controller.ts`:
  - Emits RFC 7807 problem details on error.
- Register routes in `backend/src/routes/api.routes.ts`:
  - Guarded with `authenticateJwt`, `enforceTenantIsolation`, and specific permissions (`DOC_VIEW`, `DOC_EDIT`, `DOC_VERIFY`).

### Phase 3: Angular HTTP Services & Integration
- Create `HttpReviewService` in `document-intelligence-ui/src/app/core/services/http-review.service.ts` implementing `IReviewService`.
- Create `HttpExtractionService` in `document-intelligence-ui/src/app/core/services/http-extraction.service.ts` implementing `IExtractionService`.
- Update `api-services.ts` and component providers to enable seamless switching between live HTTP and mock modes.
- Update `Review` and `ReviewWorkbench` components to handle backend data structures, loading, empty, error, and unauthorized states.

### Phase 4: Automated Testing & Verification
- Backend test suites: `review.service.spec.ts` and `review.controller.spec.ts`.
- Full backend regression test suite execution (`npm test`).
- Frontend test suite execution (`npx ng test --watch=false`).
- Frontend and backend builds (`npm run build`).
- ESLint checks across both workspaces.

### Phase 5: Closure Deliverables
- Author `docs/SPRINT_7_EXECUTION_REPORT.md` with complete evidence.
- Ensure host database safety guardrail is maintained.
