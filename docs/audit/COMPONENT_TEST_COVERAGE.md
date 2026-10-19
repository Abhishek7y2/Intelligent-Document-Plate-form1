# DocuNexa — Component-Level & Integration Test Assessment

**Audit Date:** 2026-10-13T13:12:00+05:30  
**Test Runners:** Jest 29.7.0 (Backend) | Vitest 3.0.5 (Frontend) | PostgreSQL 16 Runner  
**Audit Standard:** Actual Local Command Execution with Sanitized Output  

---

## 1. Test Execution Commands & Verification Results

### 1.1 Backend Test Execution
```bash
cd document_intelligence_platform-main/backend
npm test -- --silent
```
- **Exit Code:** `0`
- **Suites:** **43 passed, 43 total**
- **Tests:** **440 passed, 440 total (0 failed, 0 skipped)**
- **Duration:** 23.621 s
- **Coverage Highlights:**
  - Controllers: 15 / 15 tested
  - Services: 14 / 14 tested
  - Middlewares: 4 / 4 tested (Auth, Tenant Isolation, Rate Limiting, RFC 7807 Error Handler)
  - Database Safety Guard: 10 / 10 isolation tests passed

### 1.2 Frontend Test Execution
```bash
cd document_intelligence_platform-main/document-intelligence-ui
npx vitest run
```
- **Exit Code:** `0`
- **Test Files:** **9 passed, 9 total**
- **Tests:** **35 passed, 35 total (0 failed, 0 skipped)**
- **Duration:** 7.13 s
- **Coverage Highlights:**
  - `http-approval.service.spec.ts`: 5 tests passed
  - `http-compare.service.spec.ts`: 2 tests passed
  - `http-qa.service.spec.ts`: 5 tests passed
  - `http-report.service.spec.ts`: 3 tests passed
  - `http-retention.service.spec.ts`: 6 tests passed
  - `http-review.service.spec.ts`: 5 tests passed
  - `http-search.service.spec.ts`: 3 tests passed
  - `review.spec.ts`: 5 tests passed
  - `app.spec.ts`: 1 test passed

### 1.3 Database Sandbox Safety Guard Execution
```bash
cd document_intelligence_platform-main/backend
npx jest src/database/migrations/migrate.spec.ts
```
- **Exit Code:** `0`
- **Tests:** **10 passed, 10 total**
- **Verification:** Rejects ports 5432 and 5433; blocks non-sandbox database names; requires PostgreSQL 16 and pgvector.

---

## 2. Backend Component Inventory & Test Coverage

| Backend Component | Architectural Responsibility | BRD Requirements | Unit Test Reference | Integration Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **`auth.controller.ts`** | Login, refresh, logout, `/auth/me` | FR-001 | `auth.controller.spec.ts` | Session lifecycle & rate limiting |
| **`schema.controller.ts`** | Template & policy CRUD, publishing | FR-002 | `schema.controller.spec.ts` | Schema validation & immutability |
| **`intake.controller.ts`** | File upload, scan, deduplication | FR-003, FR-005 | `file-validator.spec.ts` | MIME sniffing & quarantine |
| **`ocr.controller.ts`** | OCR execution, geometry extraction | FR-008, FR-012, AI-001 | `ocr.controller.spec.ts` | Bounding box coordinates |
| **`classification.controller.ts`**| Document classification & scoring | FR-007, AI-002 | `classification.service.spec.ts`| Uncertainty handling ($<0.80$) |
| **`extraction.controller.ts`** | Field extraction & candidate storage | FR-008, AI-003 | `extraction.controller.spec.ts` | Invoice line item calculation |
| **`review.controller.ts`** | HITL workbench, field corrections | FR-010, FR-011 | `review.controller.spec.ts` | Optimistic concurrency & audit trail |
| **`approval.controller.ts`** | Sequential/parallel approval & SoD | FR-013, FR-014 | `approval.controller.spec.ts` | Separation of duties enforcement |
| **`erp.controller.ts`** | Outbound ERP sync & publishing | FR-014, INT-004 | `erp.controller.spec.ts` | Outbox event creation |
| **`search.controller.ts`** | Full-text & pgvector HNSW search | FR-016 | `search.controller.spec.ts` | Multi-tenant query isolation |
| **`compare.controller.ts`** | Side-by-side clause comparison | FR-017, AI-005 | `compare.controller.spec.ts` | Diffing between versions |
| **`qa.controller.ts`** | Grounded Q&A, citation verification | FR-019, AI-006 | `qa.controller.spec.ts` | Abstention & prompt injection |
| **`notification.controller.ts`**| Notifications & user preferences | FR-020 | `notification.controller.spec.ts`| Delivery status & read receipts |
| **`report.controller.ts`** | Governance reports & KPI summaries | FR-021 | `report.service.spec.ts` | Operational metric aggregations |
| **`export.controller.ts`** | Asynchronous CSV/JSON exports | FR-018 | `export.service.spec.ts` | PII masking & SHA-256 seal |
| **`webhook.controller.ts`** | Signed outbound webhook dispatch | FR-023 | `webhook.service.spec.ts` | HMAC-SHA256 signature & replay guard |
| **`connector.controller.ts`** | ERP/CRM field mappings & sign-off | INT-004 | `connector.service.spec.ts` | Mapping review sandbox |
| **`retention.controller.ts`** | Retention policies, legal hold, purge| FR-022 | `retention.service.spec.ts` | Legal hold freeze & SHA-256 purge seal |

---

## 3. Frontend Component Inventory & Status

| Angular Screen / Component | Route Path | Responsibility | Implementation State | Service Bound |
| :--- | :--- | :--- | :---: | :--- |
| **`DashboardComponent`** | `/dashboard` | Executive KPIs, volume charts | Complete | `MockDocumentService` |
| **`DocumentsComponent`** | `/documents` | Repository grid, filtering, status | Complete | `MockDocumentService` |
| **`IntakeComponent`** | `/intake` | File drag-and-drop, upload wizard | Complete | `MockDocumentService` |
| **`ReviewWorkbenchComponent`**| `/review/:id` | PDF viewer, bounding boxes, edits | Complete | `HttpReviewService` / Mock |
| **`ReportsComponent`** | `/reports` | Governance metrics, async export | Complete | `HttpReportService` / Mock |
| **`ApprovalsComponent`** | `/approvals` | Stepper workflow, SoD rejection | Complete | `HttpApprovalService` / Mock |
| **`CompareStudioComponent`** | `/compare` | Side-by-side clause diffing | Complete | `HttpCompareService` / Mock |
| **`QaAssistantComponent`** | `/qa` | Natural language Q&A & citations | Complete | `HttpQaService` / Mock |
| **`TasksComponent`** | `/tasks` | Reviewer assignment tasks | Complete | `MockDocumentService` |
| **`SearchComponent`** | `/search` | Elastic / pgvector search studio | Complete | `HttpSearchService` / Mock |
| **`DocumentDetailComponent`** | `/documents/:id` | Version history, audit timeline | Complete | `MockDocumentService` |
| **`AdminComponent`** | `/admin/*` | Schema builder, retention, webhooks| Complete | `HttpRetentionService` / Mock |
| **`LoginComponent`** | `/login` | Enterprise login, role switching | Complete | `AuthService` |
| **`ResetPasswordComponent`** | `/reset-password` | Self-service password recovery | Complete | `AuthService` |

---

## 4. Frontend-to-Backend HTTP Integration Gap

While individual typed `Http*Service` classes exist and pass all 35 Vitest unit tests, global Angular dependency injection in [`app.config.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/document-intelligence-ui/src/app/app.config.ts) has not yet bound `provideHttpClient(withInterceptors([...]))` as the universal provider for all injection tokens. 

Consequently, the UI currently defaults to `Mock*Service` classes in standard development/SSR runs. Wiring these tokens to the corresponding `Http*Service` classes is the immediate next integration task.
