# DocuNexa Sprint 6 — Implementation Plan
**Document Intelligence Platform — Classification, Field Extraction & Validation Engine**
**Author:** Principal AI/Backend Engineer & Document Intelligence Architect  
**Status:** Approved for Implementation Baseline  
**Date:** 12 October 2026  

---

## 1. Executive Summary & Objective

Sprint 6 bridges the gap between raw OCR/geometry extraction (Sprint 5) and human-in-the-loop review workbench (Sprint 7). Following the approved DocuNexa Business Requirements Document (BRD) and Backend PRD, this sprint delivers:
1. **Automated Document Classification (FR-004)**: Classifies documents into enterprise taxonomy types (`purchase-invoice`, `supplier-contract`, `internal-policy`) with an 80% confidence threshold gate. Documents scoring below 0.80 are flagged for manual triage.
2. **Layout-Aware Field Extraction (FR-005)**: Extracts required and optional structured business fields according to published schema templates from `SchemaService` (Sprint 3).
3. **Grounded Visual Evidence Mapping (FR-006)**: Binds every extracted field value to supporting OCR word tokens, rectangular bounding boxes (`[left, top, width, height]`), and 8-point polygons (`[x1,y1, ..., x4,y4]`).
4. **Invoice Mathematical Reconciliation Engine (FR-007)**: Enforces arithmetic validation on extracted financial figures ($|\text{net} + \text{tax} - \text{total}| \le 0.01$).
5. **Human-In-The-Loop (HITL) Review Routing (FR-008)**: Determines whether a document qualifies for Straight-Through Processing (`STP_PROCESSED`) or requires human review (`NEEDS_REVIEW` in `HUMAN_REVIEW_REQUIRED` stage) based on confidence thresholds ($\ge 0.85$), required field presence, and math reconciliation.

---

## 2. Requirements-to-Implementation-to-Test Traceability Matrix

| BRD Requirement | Functional Description | Architecture / Implementation Component | Verification Test Suite | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **FR-004** | Document Classification | `RuleBasedClassifier`<br>`ClassificationService` | `classification.service.spec.ts`<br>`classification.controller.spec.ts` | Scores $\ge 0.80$ route to `AUTO_CLASSIFIED`. Scores $< 0.80$ route to `MANUAL_TRIAGE` and mark document `NEEDS_REVIEW`. |
| **FR-005** | Layout-Aware Field Extraction | `TemplateDrivenExtractor`<br>`ExtractionService` | `extraction.service.spec.ts`<br>`extraction.controller.spec.ts` | Fields extracted match published template versions (`v2.1` for invoices, `v1.4` for contracts, `v4.2` for policies). |
| **FR-006** | Grounded Evidence Mapping | `TemplateDrivenExtractor`<br>`FieldGroundedEvidence` | `extraction.service.spec.ts` | Every extracted field references page number, text snippet, bounding box, and 8-point polygon derived from OCR word tokens. |
| **FR-007** | Invoice Math Reconciliation | `reconcileInvoiceAmounts`<br>`invoice-math-reconciler.ts` | `extraction.service.spec.ts` | Reconciles $|\text{net} + \text{tax} - \text{total}| \le 0.01$. Discrepancies mark status `MISMATCH` and fail overall validation. |
| **FR-008** | HITL Review Queue Routing | `ExtractionService.evaluateValidationAndRouting` | `extraction.service.spec.ts`<br>`extraction.controller.spec.ts` | High confidence ($\ge 0.85$), all required fields present, and valid math routes to `STP_PROCESSED`. Any violation routes to `NEEDS_REVIEW`. |
| **SEC-001** | Multi-Tenant Isolation | `enforceTenantIsolation`<br>Tenant SQL parameters | All test suites (`TNT-CORP-01` vs `TNT-CORP-02`) | Cross-tenant document classification and extraction strictly rejected with 404 / 403. |
| **SEC-002** | Security & Eligibility Gates | Pre-flight status checks in Services | `classification.service.spec.ts`<br>`extraction.service.spec.ts` | Quarantined documents rejected with 403. Unscanned or rejected documents rejected with 400. |

---

## 3. Database Schema & Migration Strategy

### 3.1 Persistence Tier Constraint & Blocker Preservation
- **Live PostgreSQL 16 Integration**: Remains **BLOCKED** as the dedicated Docker container on port 5434 has not been provisioned by DevOps/DBA.
- **Host PostgreSQL 12.12 on Port 5433**: **STRICTLY UNTOUCHED**. No migrations or DDL commands will be executed against port 5433.
- **Dual-Mode Persistence Pattern**: Following the architecture established in Sprint 4 and Sprint 5, services support `'memory'` and `'database'` persistence modes. Unit and integration tests execute against the clean in-memory tier, while production code uses parameterized transactional SQL queries.

### 3.2 Additive Migration (Migration 007)
File: `backend/src/database/migrations/007_classification_and_field_extraction.sql`
- Creates table `document_classifications`:
  - `classification_id` VARCHAR(64) PRIMARY KEY
  - `document_id` VARCHAR(64) UNIQUE REFERENCES documents(document_id)
  - `tenant_id` VARCHAR(64) NOT NULL
  - `predicted_type` VARCHAR(64) NOT NULL
  - `confidence_score` NUMERIC(5, 4) NOT NULL
  - `classifier_name` VARCHAR(128) NOT NULL
  - `is_confident` BOOLEAN NOT NULL
  - `routing_decision` VARCHAR(32) NOT NULL
  - `matching_signals` JSONB NOT NULL
  - `created_at` TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
- Creates table `document_extractions`:
  - `extraction_id` VARCHAR(64) PRIMARY KEY
  - `document_id` VARCHAR(64) UNIQUE REFERENCES documents(document_id)
  - `tenant_id` VARCHAR(64) NOT NULL
  - `document_type` VARCHAR(64) NOT NULL
  - `template_version` VARCHAR(32) NOT NULL
  - `fields` JSONB NOT NULL
  - `validation_summary` JSONB NOT NULL
  - `routing_decision` VARCHAR(32) NOT NULL
  - `created_at` TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

---

## 4. API Specification & Endpoints

1. `POST /api/v1/documents/:id/classify`
   - **Permission:** `DOC_EDIT`
   - **Pre-conditions:** Document status must be `READY_FOR_OCR` or `OCR_COMPLETED`, OCR text must exist, malware scan must be clean.
   - **Response:** 200 OK with `ClassificationResult` containing `predictedType`, `confidenceScore`, `isConfident`, and `routingDecision`.

2. `GET /api/v1/documents/:id/classification`
   - **Permission:** `DOC_VIEW`
   - **Response:** 200 OK with stored `ClassificationResult` or 404 Problem Details.

3. `POST /api/v1/documents/:id/extract`
   - **Permission:** `DOC_EDIT`
   - **Pre-conditions:** Document must have completed OCR, valid document type and published template schema must exist.
   - **Response:** 200 OK with `DocumentExtractionResult` containing fields, evidence bounding boxes/polygons, math reconciliation, and routing decision.

4. `GET /api/v1/documents/:id/extraction`
   - **Permission:** `DOC_VIEW`
   - **Response:** 200 OK with stored `DocumentExtractionResult` or 404 Problem Details.

---

## 5. Acceptance Criteria

1. **Classification Confidence Cutoff**: Documents classified with confidence score $\ge 0.80$ receive routing `AUTO_CLASSIFIED`. Those below 0.80 receive routing `MANUAL_TRIAGE` and document status transitions to `NEEDS_REVIEW`.
2. **Template Grounding**: Extracted fields strictly map to schema definition from `SchemaService` for the document type.
3. **Geometry Integrity**: Every extracted entity includes 2D bounding box and 8-point polygon coordinate array within page bounds.
4. **Math Reconciliation**: Arithmetic check verifies $|\text{net} + \text{tax} - \text{total}| \le 0.01$. Discrepancies mark `status: 'MISMATCH'` and force HITL routing.
5. **Security Gates**: Quarantined files return 403 RFC 7807 problem details; cross-tenant document requests return 404; unauthenticated requests return 401.
6. **Code Quality**: TypeScript build passes with zero errors; ESLint reports zero errors; Jest regression test suite passes 100%.
