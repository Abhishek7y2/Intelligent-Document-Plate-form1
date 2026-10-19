# DocNexa Enterprise Performance, Load, Stress & Endurance Testing Suite

This directory contains the production-grade **Apache JMeter 5.6.3** test plans, datasets, runner scripts, and automated test execution harness for the **DocNexa Document Intelligence Platform** in accordance with **BRD v1.0** (NFR-01 through NFR-08, UAT scenarios).

---

## 1. Directory Structure

```
performance-testing/
├── README.md                                   # This specification & operational runbook
├── config/
│   └── example.properties                      # Parameterized target hosts, ports, threads, timers
├── data/
│   ├── synthetic-users.csv                     # 5 synthetic tenant personas with RBAC roles
│   └── synthetic-document-metadata.csv         # Realistic test document metadata & page distributions
├── plans/                                      # Official Apache JMeter 5.6.3 (.jmx) Test Plans
│   ├── smoke-test.jmx                          # Profile 1: 1-2 VUs sanity, connectivity & assertions
│   ├── baseline-test.jmx                       # Profile 2: Low-concurrency baseline metrics
│   ├── api-load-test.jmx                       # Profile 3: Expected normal concurrent user load
│   ├── peak-load-test.jmx                      # Profile 4: Peak traffic & burst capacity
│   ├── stress-test.jmx                         # Profile 5: Above-peak stress & saturation limits
│   ├── spike-test.jmx                          # Profile 6: Sudden demand surges & queue recovery
│   ├── endurance-test.jmx                      # Profile 7: Soak test for memory leaks & latency drift
│   ├── document-workflow-test.jmx              # E2E Multi-step ingestion, review, approval workflow
│   ├── compare-search-qa-test.jmx              # Compare Studio, Hybrid Search & Grounded Q&A
│   └── document-processing-capacity-test.jmx   # Profile 8: 20-Page document batch intake & queue capacity
├── scripts/
│   ├── load-runner.mjs                         # Node.js high-concurrency automated JMeter-equivalent engine
│   ├── execute-all.mjs                         # Orchestrates all 8 performance profiles sequentially
│   ├── run-smoke-test.sh / .ps1               # Smoke test execution scripts (JMeter CLI / fallback)
│   ├── run-load-test.sh / .ps1                # Normal load test execution scripts
│   ├── run-all-profiles.ps1                    # Full 8-profile suite execution script
│   └── generate-report.sh                      # Results extraction and console summary
├── results/                                    # Raw execution metrics, percentiles & status codes
│   ├── smoke/
│   ├── baseline/
│   ├── load/
│   ├── peak/
│   ├── stress/
│   ├── spike/
│   ├── endurance/
│   └── capacity/
└── reports/                                    # Comprehensive analysis & executive deliverables
    ├── jmeter-performance-report.md            # Master Executive & Engineering Performance Report
    ├── bottleneck-analysis.md                  # Deep-dive root cause analysis & resource telemetry
    ├── remediation-plan.md                     # Architectural, database & caching optimizations
    └── brd-performance-traceability.csv        # BRD NFR traceability matrix (PASS/FAIL/BLOCKED)
```

---

## 2. Test Profiles & Workload Models

| Profile # | Profile Name | Virtual Users | Ramp-Up | Duration | Workload Mix | Target Objectives |
|---|---|---|---|---|---|---|
| **Profile 1** | **Smoke Test** | 2 | 1s | 10s | Public Health, Ready, Search, Docs, Compare | Health verification, auth check, assertion validation |
| **Profile 2** | **Baseline Test** | 5 | 2s | 15s | Search, Docs, Compare, Q&A, Reviews, Notifications | Establish baseline latency percentiles (p50, p90, p95, p99) |
| **Profile 3** | **Normal Load** | 15 | 3s | 20s | Full Read/Write: Search, Compare, Q&A, Upload, Reviews | Validate normal business concurrency under realistic think time |
| **Profile 4** | **Peak Load** | 30 | 4s | 20s | Heavy Search, Compare, Grounded Q&A, File Uploads | Verify p95 < 1s (NFR-02) and Upload ACK < 5s (NFR-03) |
| **Profile 5** | **Stress Test** | 50 | 5s | 20s | Aggressive concurrent Read/Write operations | Identify saturation limits, queue backpressure, recovery |
| **Profile 6** | **Spike Test** | 60 | 1s | 15s | Instant traffic spike on Search & Compare | Measure transient timeout rates and buffer draining |
| **Profile 7** | **Endurance / Soak** | 10 | 2s | 30s | Sustained steady load across core endpoints | Detect memory leaks, unclosed handles, and latency drift |
| **Profile 8** | **Document Capacity** | 10 | 2s | 20s | 20-Page PDF uploads, OCR pipeline, Search | Verify NFR-03 (ACK < 5s) and NFR-04 (20-page processing) |

---

## 3. How to Run

### Apache JMeter CLI (Non-GUI Mode)
When Apache JMeter 5.6.3 and Java are installed:
```bash
# Execute Smoke Test and generate HTML Dashboard
jmeter -n -t performance-testing/plans/smoke-test.jmx \
       -p performance-testing/config/example.properties \
       -l performance-testing/results/smoke/results.jtl \
       -e -o performance-testing/results/smoke/dashboard

# Execute API Load Test
jmeter -n -t performance-testing/plans/api-load-test.jmx \
       -p performance-testing/config/example.properties \
       -l performance-testing/results/load/results.jtl \
       -e -o performance-testing/results/load/dashboard
```

### Automated Multi-Platform Runner
When running on developer machines without global administrative elevation:
```powershell
# Run entire 8-profile suite
powershell -File performance-testing/scripts/run-all-profiles.ps1

# Or run directly via Node.js
node performance-testing/scripts/execute-all.mjs
```
