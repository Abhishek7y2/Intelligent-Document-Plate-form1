# DocuNexa Sprint 10 — Implementation Plan: Grounded Q&A, Retrieval Security & AI Evaluation

**Document Version:** 1.0.0  
**Target Architecture:** Node.js 22 LTS, TypeScript, Express, PostgreSQL 16 + pgvector, Angular 19  
**Roles:** Senior Software Architect, AI Engineer, RAG Engineer, Backend Engineer, Application Security Engineer, PostgreSQL Engineer, Angular Engineer, Lead QA Engineer  
**Status:** **AUTHORITATIVE IMPLEMENTATION PLAN**  

---

## 1. Overview & Architectural Objectives

Sprint 10 delivers a secure, evidence-grounded Conversational Question & Answering (RAG) system for the DocuNexa Enterprise Document Intelligence Platform (FR-013, FR-015, AI-004, AI-006, ADR-001, ADR-002).

### Core Invariants & Safety Mandates:
1. **Evidence-Grounded Answers Only:** Every material factual claim must be backed by currently authorized document evidence or clearly flagged as uncertain. The system must abstain (`INSUFFICIENT_EVIDENCE`) rather than hallucinate answers.
2. **Conflicting Evidence Surfacing:** When retrieved source documents or versions present contradictory facts, the conflict must be explicitly identified to the user.
3. **Mandatory Multi-Tenant & Version Fencing:** Retrieval queries and citation resolvers must filter strictly by `tenant_id`. Documents marked `QUARANTINED`, `FAILED_SCAN`, or `DELETED` are strictly excluded.
4. **Click-Time Citation Access Re-check:** Citation click navigation revalidates document existence, tenant boundary, and user `DOC_VIEW` authorization on the server. Revoked permissions or deleted documents return sanitized 403/404 responses without leaking titles or snippets.
5. **Prompt Injection Boundary:** All document text, OCR tokens, and user inputs are strictly treated as untrusted data. Embedded instructions attempting to override safety, extract cross-tenant data, or trigger workflows are neutralized.
6. **AI Separation from Human Authority:** The AI service identity is strictly read-only and is architecturally barred from calling approval, deletion, or ERP publication endpoints.

---

## 2. Requirement-to-Architecture Traceability Matrix

| Requirement | Description | Target Code Entities | Test Suites | Verification Evidence |
|---|---|---|---|---|
| **FR-013 / AI-006** | Grounded Q&A with mandatory citations & abstention | `QaService`, `ModelProviderService`, `POST /api/v1/qa/query` | `qa.service.spec.ts`, `qa-evaluation.spec.ts` | 100% citations ground to retrieved chunks; abstention on missing data |
| **FR-014 / ADR-002** | Vector & full-text hybrid retrieval with pgvector | `SearchService`, `document_chunks` table on PostgreSQL 16 | `search.service.spec.ts`, `postgres-16-sandbox.integration.spec.ts` | Cosine similarity `<=>` ranking on 1536-dim vectors |
| **FR-015** | RBAC permission gating (`QA_QUERY`, `DOC_VIEW`) | `authenticateJwt`, `enforceTenantIsolation`, `requirePermission` | `qa.controller.spec.ts`, `qa-security.spec.ts` | Auditor role lacking `QA_QUERY` rejected with 403 |
| **AI-004** | Prompt injection defense & untrusted data delimiting | `ModelProviderService`, `QaService` | `qa-security.spec.ts` | Adversarial injection queries safely neutralized |
| **BRD Sec 12** | Click-time citation authorization re-check | `QaService.verifyCitationAccess`, `POST /api/v1/qa/citations/verify` | `qa-security.spec.ts`, `qa.controller.spec.ts` | Access denied modal on revoked/restricted citations |
| **FR-012** | Version freshness notices on superseded documents | `QaService.checkDocumentFreshness` | `qa.service.spec.ts` | Warning when answering from superseded document version |
| **FR-022** | Tamper-evident Q&A trace & citation audit | Migration `012`, `qa_traces`, `qa_citations` | `qa.service.spec.ts`, database ledger | Full trace audit logged with correlation IDs |
| **UI SCR-12** | Angular 19 Grounded Q&A Assistant screen | `HttpQaService`, `QaComponent` (`features/qa/qa.ts`) | `http-qa.service.spec.ts`, `qa.spec.ts` | Real backend integration replacing `MockQaService` |

---

## 3. Database Migration Plan (Migration 012)

Create ordered migration `012_grounded_qa_traces_and_citations.sql`:
- Table `qa_traces`: Stores audit record of every Q&A interaction with model parameters, timing, status, and abstention reasons.
- Table `qa_citations`: Stores exact evidence snippets, page numbers, and span links associated with each answer.
- Scoped permissions granted to least-privilege role `docunexa_app`.

---

## 4. Execution Sequence

1. **Database Schema:** Create migration `012_grounded_qa_traces_and_citations.sql` and execute against PostgreSQL 16 sandbox on port 5434.
2. **Backend Models & Contracts:** Create `qa.models.ts` with typed requests, responses, citations, and trace schemas.
3. **Model Provider Service:** Create `model-provider.service.ts` with `IModelProvider`, `SyntheticModelProvider`, and `OpenAiCompatibleModelProvider`.
4. **Q&A Domain Service:** Create `qa.service.ts` with authorized retrieval, prompt injection defense, grounding verification, abstention, conflict detection, citation verification, and trace persistence.
5. **REST API Controller & Routes:** Create `qa.controller.ts` and register `/qa/query`, `/qa/citations/verify`, `/qa/documents`, `/qa/traces/:traceId/feedback` in `api.routes.ts`.
6. **Angular Integration:** Create `http-qa.service.ts`, integrate `HttpQaService` into `qa.ts`, and remove mock-backed execution paths.
7. **Comprehensive Test Suite:** Implement `qa.service.spec.ts`, `qa-security.spec.ts`, `qa-evaluation.spec.ts`, `qa.controller.spec.ts`, `http-qa.service.spec.ts`, and frontend tests.
8. **Regression & Build Verification:** Run full backend and frontend regression suites, production builds, and linting.
9. **Final Audit Reporting:** Deliver authoritative verification and execution reports for Sprint 10 sign-off.
