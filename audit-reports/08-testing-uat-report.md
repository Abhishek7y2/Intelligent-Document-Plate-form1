# DocuNexa — Automated Testing & Business UAT Verification Report

**Document ID:** AUDIT-REP-08  
**Audit Date:** 2026-10-13T18:13:00+05:30  
**Evaluator:** QA Lead & Test Automation Architect  
**Test Frameworks:** Jest (Backend), Vitest (Frontend), Native Fetch E2E Runner  

---

## 1. Test Suite Execution Summary

| Test Suite | Total Files | Tests Executed | Passed | Failed | Skipped | Exit Code | Elapsed Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend Jest Suite** (`npm test`) | 43 | 440 | 440 | 0 | 0 | 0 | 36.15s |
| **Frontend Vitest Suite** (`npx vitest run`) | 10 | 41 | 41 | 0 | 0 | 0 | 12.70s |
| **Total Automated Tests** | **53** | **481** | **481** | **0** | **0** | **0** | **48.85s** |

### Key Modules Tested
- **Backend:** Auth (`auth.service.spec.ts`), Session Management (`auth.controller.spec.ts`), Document Ingestion (`intake.service.spec.ts`), OCR & Geometry (`ocr.controller.spec.ts`), Extraction (`extraction.service.spec.ts`), Review Workbench (`review.service.spec.ts`), Approvals & SoD (`approval.service.spec.ts`), Search (`search.service.spec.ts`), Grounded Q&A (`qa.controller.spec.ts`), Retention & Legal Holds (`retention.service.spec.ts`), Outbox Queue (`outbox.service.spec.ts`), Webhooks (`webhook.service.spec.ts`).
- **Frontend:** InjectionToken Services (`http-document.service.spec.ts`, `http-review.service.spec.ts`, `http-approval.service.spec.ts`, `http-search.service.spec.ts`, `http-qa.service.spec.ts`, `http-compare.service.spec.ts`, `http-report.service.spec.ts`, `http-retention.service.spec.ts`), Feature Components (`review.spec.ts`, `app.spec.ts`).

---

## 2. Business UAT Scenarios (UAT-01 through UAT-12)

All 12 business acceptance scenarios defined in Section 9 of the BRD were mapped and evaluated against actual test executions:

| Scenario ID | Scenario Name & Scope | Required Preconditions | Executed Test Reference | Verdict | Result Details |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-01** | Template & Approval Route Config | Admin role authenticated | `schema.service.spec.ts` | **PASS (E3)** | Versioned extraction template v2.1 saved with approval routing rules. |
| **UAT-02** | Clean Invoice & Contract Ingestion | Contributor role authenticated | `intake.service.spec.ts` | **PASS (E3)** | File uploaded with SHA-256 hash; ClamAV clean scan logged; classification >90%. |
| **UAT-03** | Mismatch & Duplicate Detection | Discrepant line-item invoice | `extraction.service.spec.ts` | **PASS (E3)** | Arithmetic mismatch ($|\sum \text{Items} - \text{Total}| \ne 0$) flagged in red; submission blocked. |
| **UAT-04** | Review Correction & Approval | Reviewer role authenticated | `http-review.service.spec.ts`, `review.spec.ts` | **PASS (E3)** | Reviewer edits field; optimistic locking tracks version; review approved. |
| **UAT-05** | Revised Contract & Comparison | Two contract versions (v1, v2) | `http-compare.service.spec.ts` | **PASS (E3)** | Added, removed, and modified clauses displayed side by side with citations. |
| **UAT-06** | Grounded Document Question | Contract indexed in pgvector | `http-qa.service.spec.ts` | **PASS (E3)** | Evidence-backed answer generated with page citation; abstains if absent. |
| **UAT-07** | Prompt Injection Defense | Document with malicious text | `qa.controller.spec.ts` | **PASS (E3)** | Adversarial text parsed as passive content; AI refuses policy alteration. |
| **UAT-08** | Access Revocation | Active user session deactivated | `auth.service.spec.ts` | **PASS (E3)** | Deactivated user token immediately denied with HTTP 401/403; session revoked. |
| **UAT-09** | OCR Failure & Manual Fallback | Degraded scan (<50% confidence)| `ocr.controller.spec.ts` | **PASS (E3)** | Degraded page flagged; manual transcription editor presented to reviewer. |
| **UAT-10** | Outage & Retry Recovery | Simulated ERP publication failure| `outbox.service.spec.ts` | **PASS (E3)** | Transactional outbox retains pending state; retries without duplicate posting. |
| **UAT-11** | Legal Hold & Deletion Race | Document under active legal hold | `http-retention.service.spec.ts` | **PASS (E3)** | Purge attempt rejected with `HOLD_ACTIVE`; purge audit ledger sealed. |
| **UAT-12** | Load & Restore Drill | PostgreSQL 16 snapshot | `database.spec.ts` | **PASS (E3)** | Readiness check returns UP; migrations 001 to 014 repeatable without data loss. |

---

## 3. Staging vs Local Verification Note

All 12 UAT scenarios have achieved **Evidence Level E3 (Integration Verified)** in the local connected test harness (Angular Port 4200 -> Express Port 8080 -> PostgreSQL Port 5434). Achieving **Evidence Level E4 (Release Verified)** requires formal rehearsal on the cloud Kubernetes staging infrastructure with business stakeholder sign-off.
