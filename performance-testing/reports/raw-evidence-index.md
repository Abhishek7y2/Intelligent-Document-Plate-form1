# DocNexa Performance Testing — Raw Evidence, Test Artifacts & Provenance Index

**Authoritative Specification**: Document Intelligence Platform BRD v1.0  
**Repository Working Tree**: `c:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main`  
**Git HEAD Commit**: `e9d098ee9cc0d093e3c5171d5aa3625752ba0deb`  
**Date**: 2026-10-14  

---

## 1. Directory Structure of Raw Evidence

```
performance-testing/
├── config/
│   └── example.properties                      # Test execution variables (host, port, concurrency, timers)
├── data/
│   ├── synthetic-users.csv                     # 5 synthetic tenant personas with distinct RBAC roles
│   └── synthetic-document-metadata.csv         # Realistic test document metadata & page distributions
├── plans/                                      # 10 Official Apache JMeter 5.6.3 (.jmx) Test Plans
│   ├── smoke-test.jmx                          # Profile 1 JMX Test Plan
│   ├── baseline-test.jmx                       # Profile 2 JMX Test Plan
│   ├── api-load-test.jmx                       # Profile 3 JMX Test Plan
│   ├── peak-load-test.jmx                      # Profile 4 JMX Test Plan
│   ├── stress-test.jmx                         # Profile 5 JMX Test Plan
│   ├── spike-test.jmx                          # Profile 6 JMX Test Plan
│   ├── endurance-test.jmx                      # Profile 7 JMX Test Plan
│   ├── document-workflow-test.jmx              # E2E Workflow JMX Test Plan
│   ├── compare-search-qa-test.jmx              # Compare, Search & Grounded Q&A JMX Test Plan
│   └── document-processing-capacity-test.jmx   # Profile 8 20-Page Capacity JMX Test Plan
├── results/
│   ├── archive-baseline/                       # Preserved baseline evidence before index optimization
│   │   ├── all-profiles-summary.json           # Raw consolidated baseline metrics
│   │   ├── smoke/report.md & summary.json
│   │   ├── baseline/report.md & summary.json
│   │   ├── load/report.md & summary.json
│   │   ├── peak/report.md & summary.json
│   │   ├── stress/report.md & summary.json
│   │   ├── spike/report.md & summary.json
│   │   ├── endurance/report.md & summary.json
│   │   └── capacity/report.md & summary.json
│   ├── all-profiles-summary.json               # Master post-optimization empirical results
│   ├── smoke/report.md & summary.json          # Post-optimization Smoke profile
│   ├── baseline/report.md & summary.json       # Post-optimization Baseline profile
│   ├── load/report.md & summary.json           # Post-optimization Normal Load profile
│   ├── peak/report.md & summary.json           # Post-optimization Peak Load profile
│   ├── stress/report.md & summary.json         # Post-optimization Stress Load profile
│   ├── spike/report.md & summary.json          # Post-optimization Spike Load profile
│   ├── endurance/report.md & summary.json       # Post-optimization 60s Endurance profile
│   └── capacity/report.md & summary.json        # Post-optimization Document Capacity profile
└── reports/
    ├── jmeter-performance-report.md            # Executive Performance & Verification Report
    ├── bottleneck-analysis.md                  # Deep-dive root cause analysis & resource telemetry
    ├── remediation-plan.md                     # Prioritized architectural optimizations
    ├── brd-performance-traceability.csv        # BRD NFR traceability matrix (PASS/FAIL/BLOCKED)
    ├── database-index-review.md                # PostgreSQL 16 query plans & index efficiency review
    ├── frontend-performance.md                 # Angular 19 bundle size, preloading & UX metrics
    ├── performance-before-after.md             # Controlled baseline vs optimized comparison
    ├── security-and-rbac-load-validation.md    # RBAC error classification & isolation report
    ├── endurance-and-recovery-report.md        # 60s soak test & post-spike recovery report
    └── raw-evidence-index.md                   # This master evidence index
```

---

## 2. Test Execution Commands & Artifact Provenance

### 2.1. Executed Test Commands
* **Full Post-Optimization Performance Suite (8 Profiles)**:
  ```powershell
  node performance-testing/scripts/execute-all.mjs
  ```
  *Output Log*: Captured in `.system_generated/tasks/task-794.log`  
  *Execution Time*: 2026-10-14T05:27:24Z to 2026-10-14T05:30:29Z (185 seconds)  
  *Total Requests Processed*: **24,625 HTTP requests**  
  *Database Engine*: PostgreSQL 16.3 (`docunexa_sandbox` on port 5434)  

* **DEF-PERF-01 Regression Test Suite**:
  ```powershell
  npm test -- src/services/ocr-storage-regression.spec.ts
  ```
  *Result*: 6 passed, 1 total suite, 100% pass rate.  

* **PostgreSQL EXPLAIN (ANALYZE, BUFFERS) Benchmark**:
  ```powershell
  node scripts/test-index.mjs
  ```
  *Result*: Verified 64% execution time reduction and 60% buffer I/O reduction on `documents` table via index `idx_documents_tenant_uploaded_at`.

---

## 3. Code & Schema Modifications

| File Path | Nature of Change | Purpose / Impact |
|---|---|---|
| [`backend/src/services/intake.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/intake.service.ts) | Code Fix | Seeded authentic PDF & DOCX byte streams for default documents in `seedDefaultDocuments()` |
| [`backend/src/services/ocr.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/ocr.service.ts) | Code Fix | Enforced strict fail-safe check: throws 404 `STORAGE_PAYLOAD_NOT_FOUND` in production; prevents silent payload fabrication |
| [`backend/src/services/ocr-storage-regression.spec.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/ocr-storage-regression.spec.ts) | New Test Suite | Added 6 automated regression tests for storage integrity, tenant isolation, and duplicate processing |
| [`backend/src/database/migrations/015_performance_and_search_indexes.sql`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/database/migrations/015_performance_and_search_indexes.sql) | New Migration | Applied composite indexes `idx_documents_tenant_uploaded_at` and `idx_documents_tenant_type_status` |
| [`performance-testing/scripts/load-runner.mjs`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/performance-testing/scripts/load-runner.mjs) | Harness Fix | Added error classification (expected RBAC denials vs genuine system failures) and process memory telemetry |
| [`performance-testing/scripts/execute-all.mjs`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/performance-testing/scripts/execute-all.mjs) | Harness Fix | Extended endurance soak test to 60s and updated profile execution pipeline |

---

## 4. Primary Results Summary Index

* **Raw Post-Optimization JSON**: [`performance-testing/results/all-profiles-summary.json`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/performance-testing/results/all-profiles-summary.json)
* **Preserved Raw Baseline JSON**: [`performance-testing/results/archive-baseline/all-profiles-summary.json`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/performance-testing/results/archive-baseline/all-profiles-summary.json)
