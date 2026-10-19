# DocuNexa Sprint 6 — Execution Report
**Classification, Field Extraction, and Validation Pipeline**
**Roles:** Principal AI/Backend Engineer, Document Intelligence Architect, QA Lead, Security Reviewer  
**Sprint Outcome:** **CONDITIONAL PASS**  
**Execution Date:** 12 October 2026  

---

## 1. Executive Summary

Sprint 6 implements the core document classification, layout-aware structured field extraction, visual evidence grounding, mathematical validation, and human-in-the-loop (HITL) review routing capabilities of the DocuNexa platform.

All implementations strictly adhere to the approved Business Requirements Document (BRD) and Backend PRD:
- **FR-004**: Automated document classification with an 80% confidence threshold gate routing to `AUTO_CLASSIFIED` vs `MANUAL_TRIAGE`.
- **FR-005**: Layout-aware key-value and entity extraction driven by versioned schema templates (`SchemaService`).
- **FR-006**: Grounded visual evidence mapping linking every extracted entity to source page number, bounding box `[left, top, width, height]`, and 8-point polygon coordinates `[x1,y1, ..., x4,y4]`.
- **FR-007**: Invoice mathematical reconciliation engine enforcing $|\text{net} + \text{tax} - \text{total}| \le 0.01$.
- **FR-008**: HITL review queue routing directing high-confidence, arithmetic-valid records to `STP_PROCESSED` and uncertain or discrepant documents to `NEEDS_REVIEW`.

### Verification Highlights:
- **Test Results**: **213/213 tests passed** across 19 test suites (53 new tests added in Sprint 6; 160 regression tests preserved).
- **TypeScript Build**: **Passed with exit code 0** (`tsc` reported 0 errors).
- **ESLint**: **Passed with exit code 0** (0 errors).
- **Live Database Status**: PostgreSQL 16 container remains **BLOCKED**; host PostgreSQL 12.12 on port 5433 remains **STRICTLY UNTOUCHED**.
- **Data Minimization & Security**: Zero raw document content or PII exposed in logs; cross-tenant access rejection validated.

---

## 2. Requirements-to-Implementation-to-Test Traceability Matrix

| Requirement | Scope & Business Rule | Source Implementation | Test Verification Suite | Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **FR-004** | **Automated Classification**: Classify into `purchase-invoice`, `supplier-contract`, `internal-policy`. Confidence $\ge 0.80 \rightarrow \text{AUTO\_CLASSIFIED}$; $< 0.80 \rightarrow \text{MANUAL\_TRIAGE}$ (`NEEDS_REVIEW`). Boundary 0.80 vs 0.799 tested. | [`rule-based-classifier.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/rule-based-classifier.ts)<br>[`classification.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/classification.service.ts) | `classification.service.spec.ts`<br>`classification.controller.spec.ts` | **PASS** |
| **FR-005** | **Layout-Aware Extraction**: Extract business entities mapped to published schema template versions (`v2.1` invoice, `v1.4` contract, `v4.2` policy). Reject unconfigured schemas. | [`template-driven-extractor.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/template-driven-extractor.ts)<br>[`extraction.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/extraction.service.ts) | `extraction.service.spec.ts`<br>`extraction.controller.spec.ts` | **PASS** |
| **FR-006** | **Grounded Evidence Mapping**: Link extracted fields to OCR word tokens, bounding boxes (`[left, top, width, height]`), and 8-point polygons within page coordinate bounds [2550x3300]. | [`template-driven-extractor.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/template-driven-extractor.ts)<br>[`extraction.models.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/models/extraction.models.ts) | `extraction.service.spec.ts` | **PASS** |
| **FR-007** | **Invoice Math Reconciliation**: Evaluate $|\text{net} + \text{tax} - \text{total}| \le 0.01$. Floating boundary tolerance supported. Tested <= 0.010, > 0.010, negative credits, zero values, incomplete inputs. | [`invoice-math-reconciler.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/utils/invoice-math-reconciler.ts) | `extraction.service.spec.ts` | **PASS** |
| **FR-008** | **HITL Review Routing**: Documents with field confidence $< 0.85$, missing required fields, or math mismatch route to `NEEDS_REVIEW`. Clean records route to `STP_PROCESSED`. Boundary 0.850 vs 0.849 tested. | [`extraction.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/extraction.service.ts) | `extraction.service.spec.ts` | **PASS** |
| **SEC-001** | **Multi-Tenant Isolation**: Server-side tenant boundary enforcement on classification and extraction CRUD endpoints. Cross-tenant access rejected with 404 / 403. | [`auth.middleware.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/middleware/auth.middleware.ts)<br>Services tenant parameters | All spec suites (`TNT-CORP-01` vs `TNT-CORP-02`) | **PASS** |
| **SEC-002** | **Quarantine & Pre-flight Gates**: Strictly reject quarantined files (403), rejected files (400), unscanned files (400), and documents without completed OCR (400). | `ClassificationService`<br>`ExtractionService` | `classification.service.spec.ts`<br>`extraction.service.spec.ts` | **PASS** |

---

## 3. Files Created and Modified

### 3.1 New Source Files Created
1. `backend/src/database/migrations/007_classification_and_field_extraction.sql`: Additive DDL for `document_classifications` and `document_extractions` with JSONB payloads.
2. `backend/src/models/extraction.models.ts`: Strongly typed TypeScript models for classification results, extracted fields, visual evidence, math reconciliation, and validation summaries.
3. `backend/src/utils/invoice-math-reconciler.ts`: Financial arithmetic reconciliation engine enforcing the $\le 0.01$ delta tolerance.
4. `backend/src/services/rule-based-classifier.ts`: Heuristic and layout keyword classifier implementing the 0.80 cutoff for taxonomy routing.
5. `backend/src/services/classification.service.ts`: Document classification orchestrator managing state transitions, eligibility gates, and persistence.
6. `backend/src/services/template-driven-extractor.ts`: Spatial token matching engine deriving bounded coordinates, 8-point polygons, and regex constraint validation.
7. `backend/src/services/extraction.service.ts`: Full extraction orchestrator evaluating schema compliance, math checks, and HITL routing.
8. `backend/src/controllers/classification.controller.ts`: REST controller handling `POST /classify` and `GET /classification` with RFC 7807 problem details.
9. `backend/src/controllers/extraction.controller.ts`: REST controller handling `POST /extract` and `GET /extraction` with RFC 7807 problem details.
10. `docs/SPRINT_6_IMPLEMENTATION_PLAN.md`: Full architectural and implementation plan.
11. `docs/SPRINT_6_EXECUTION_REPORT.md`: This execution and verification report.

### 3.2 New Test Suites Created
1. `backend/src/services/classification.service.spec.ts`: 13 tests covering eligibility gates, high-confidence classification, manual triage (< 0.80), boundary 0.80 vs 0.799, and persistence.
2. `backend/src/services/extraction.service.spec.ts`: 26 tests covering eligibility gates, invoice extraction, contract/policy templates, arithmetic boundary reconciliation, STP vs review routing, and boundary 0.850 vs 0.849.
3. `backend/src/controllers/classification.controller.spec.ts`: 7 tests verifying HTTP status codes (200, 400, 401, 403, 404) and RFC 7807 responses.
4. `backend/src/controllers/extraction.controller.spec.ts`: 7 tests verifying HTTP status codes and RFC 7807 problem details.

### 3.3 Existing Files Modified
1. `backend/src/services/schema.service.ts`: Seeded default published templates for `supplier-contract` (`v1.4`) and `internal-policy` (`v4.2`) alongside `purchase-invoice` (`v2.1`).
2. `backend/src/routes/api.routes.ts`: Mounted `/documents/:id/classify`, `/documents/:id/classification`, `/documents/:id/extract`, and `/documents/:id/extraction`.

---

## 4. Verification Execution Evidence

### 4.1 TypeScript Compilation
- **Command:** `npm run build`
- **Output:**
  ```text
  > docunexa-backend@1.0.0 build
  > tsc
  ```
- **Exit Code:** `0` (Zero compiler errors)

### 4.2 ESLint Static Analysis
- **Command:** `npm run lint`
- **Output:**
  ```text
  > docunexa-backend@1.0.0 lint
  > eslint src

  ✖ 7 problems (0 errors, 7 warnings)
  ```
- **Exit Code:** `0` (Zero lint errors across all newly added and existing files)

### 4.3 Automated Jest Test Suites
- **Command:** `npm test`
- **Output:**
  ```text
  Test Suites: 19 passed, 19 total
  Tests:       213 passed, 213 total
  Snapshots:   0 total
  Time:        10.802 s
  Ran all test suites.
  ```
- **Exit Code:** `0`
- **Suite Breakdown:**
  - `src/services/classification.service.spec.ts` — 13 passed
  - `src/services/extraction.service.spec.ts` — 26 passed
  - `src/controllers/classification.controller.spec.ts` — 7 passed
  - `src/controllers/extraction.controller.spec.ts` — 7 passed
  - 15 Regression Suites (Sprint 0–5) — 160 passed
  - **Total:** 213 passed, 0 failed

---

## 5. Security and Architectural Review

1. **Host Database Protection**:
   - The PostgreSQL 12.12 instance on port 5433 (`docunexa`, 49 tables) was untouched throughout execution.
   - No migrations or drop scripts were executed against port 5433.
2. **PostgreSQL 16 Isolated Sandbox Status**:
   - Live integration remains explicitly labeled **BLOCKED**.
   - Dual-mode architecture enables full offline mock-based testing while providing verified, parameterized SQL queries in migration 007.
3. **Data Minimization & Log Hygiene**:
   - Logger payloads emit only document metadata, predicted taxonomy IDs, and confidence numbers.
   - Raw document text, extracted PII, and financial token strings are strictly omitted from log statements.
4. **Tenant Isolation**:
   - All extraction and classification lookups require `tenant_id` validation. Requests across tenant boundaries fail with 404 or 403.

---

## 6. Stop Conditions & Remaining Blockers

1. **Docker Container for PostgreSQL 16 (Port 5434)**:
   - Remains blocked pending DBA/DevOps provisioning.
2. **Sprint Scope Boundary**:
   - Sprint 6 classification, field extraction, geometry grounding, math reconciliation, and HITL routing scope is fully complete.
   - Angular UI integration and Sprint 7 Review Workbench were not started, respecting the sprint boundary stop condition.

---

## 7. Recommendation and Next Steps

Sprint 6 is recommended for **CONDITIONAL PASS** status. The platform is ready for Sprint 7:
- **Sprint 7 Focus**: Human-in-the-Loop Review Workbench & Angular 19 UI Integration (connecting the split-screen studio, bounding-box overlay canvas, and manual reviewer corrections).
