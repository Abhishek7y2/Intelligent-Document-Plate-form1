# DocNexa — Automated Testing & Business UAT Verification Report (Reconciled Baseline v2.0)

**Document ID:** AUDIT-REP-08-V2  
**Audit Date:** 2026-10-13T18:44:00+05:30  
**Evaluator:** QA Lead & Test Automation Architect  
**Test Frameworks:** Jest (Backend), Vitest (Frontend), Native Fetch E2E Runner  

---

## 1. Test Suite Execution Summary

| Test Suite | Total Files | Tests Executed | Passed | Failed | Skipped | Exit Code | Elapsed Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend Jest Suite** (`npm test`) | 43 | 440 | 440 | 0 | 0 | 0 | 36.15s |
| **Frontend Vitest Suite** (`npx vitest run`) | 10 | 41 | 41 | 0 | 0 | 0 | 12.70s |
| **Total Automated Tests** | **53** | **481** | **481** | **0** | **0** | **0** | **48.85s** |

### Execution Breakdown & Discrepancy Reconciliation
- **Discrepancy Resolution (433 vs 440):** An earlier preliminary report noted 433 backend tests. The current complete Jest run discovers and executes all 43 test suites, confirming **440 unique passing tests** (including database integration and UAT tests in `release-sprint13.spec.ts`).
- **Frontend Vitest Count:** 41 unique tests passed across 10 suites (`http-*.service.spec.ts` and component specs).
- **Execution Evidence:** Zero skipped tests, zero failed tests, zero mock fallbacks in production providers.

---

## 2. Business UAT Scenarios (UAT-01 through UAT-12)

All 12 business acceptance scenarios defined in Section 9 of the BRD were mapped and evaluated against actual test executions:

| Scenario ID | Scenario Name & Scope | Required Preconditions | Executed Test Reference | Verdict | Result Details |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-01** | Template & Approval Route Config | Admin role authenticated | `schema.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Versioned extraction template v2.1 saved with approval routing rules. |
| **UAT-02** | Clean Invoice & Contract Ingestion | Contributor role authenticated | `intake.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | File uploaded with SHA-256 hash; ClamAV clean scan logged; classification >90%. |
| **UAT-03** | Mismatch & Duplicate Detection | Discrepant line-item invoice | `extraction.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Arithmetic mismatch ($|\sum \text{Items} - \text{Total}| \ne 0$) flagged in red; submission blocked. |
| **UAT-04** | Review Correction & Approval | Reviewer role authenticated | `http-review.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Reviewer edits field; optimistic locking tracks version; review approved. |
| **UAT-05** | Revised Contract & Comparison | Two contract versions (v1, v2) | `http-compare.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Added, removed, and modified clauses displayed side by side with citations. |
| **UAT-06** | Grounded Document Question (FR-019) | Contract indexed in pgvector | `http-qa.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Evidence-backed answer generated with page citation; abstains if absent. |
| **UAT-07** | Prompt Injection Defense | Document with malicious text | `qa.controller.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Adversarial text parsed as passive content; AI refuses policy alteration. |
| **UAT-08** | Access Revocation | Active user session deactivated | `auth.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Deactivated user token immediately denied with HTTP 401/403; session revoked. |
| **UAT-09** | OCR Failure & Manual Fallback | Degraded scan (<50% confidence)| `ocr.controller.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Degraded page flagged; manual transcription editor presented to reviewer. |
| **UAT-10** | Outage & Retry Recovery | Simulated ERP publication failure| `outbox.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Transactional outbox retains pending state; retries without duplicate posting. |
| **UAT-11** | Legal Hold & Deletion Race | Document under active legal hold | `http-retention.service.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Purge attempt rejected with `HOLD_ACTIVE`; purge audit ledger sealed. |
| **UAT-12** | Load & Restore Drill | PostgreSQL 16 snapshot | `database.spec.ts`, `release-sprint13.spec.ts` | **PASS (E3)** | Readiness check returns UP; migrations 001 to 014 repeatable without data loss. |

---

## 3. Tiered Evidence Separation (Local E3 vs Cloud E4)

- **Evidence Level E3 (Integration Verified in Local Harness):** 100% (12/12 scenarios passed). Verified against live connected runtime (Angular Port 4200, Express Port 8080, PostgreSQL 16 Port 5434).
- **Evidence Level E4 (Release Verified on Cloud Staging):** Pending. Formal release sign-off requires deployment onto a cloud Kubernetes staging cluster and guided business stakeholder sign-off.
