# Profile: baseline

**Description**: Low concurrency (5 VUs) establishing normal response times, throughput, and error rate

| Metric | Value |
|---|---|
| Concurrency | 5 virtual users |
| Duration | 15s |
| Total Requests | 446 |
| Successful Business Transactions | 446 |
| Expected Business Denials (RBAC 403) | 0 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 29.6 req/sec |
| Latency p50 | 5.13 ms |
| Latency p90 | 8.36 ms |
| Latency p95 | 9.67 ms |
| Latency p99 | 13.98 ms |
| Process Heap Memory | 17.7 MB |
| Process RSS Memory | 65.1 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 65 | 2.97 | 4.98 | 4.1 | 7.78 | 9.79 | 12.79 | 12.79 |
| GET /documents/:id | 65 | 2.78 | 4.29 | 3.68 | 6.2 | 6.55 | 8.43 | 8.43 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 65 | 4.66 | 7.52 | 7.42 | 10.03 | 12.46 | 15.57 | 15.57 |
| POST /qa/query (Grounded AI) | 63 | 3.5 | 5.88 | 5.33 | 7.75 | 10.21 | 14.69 | 14.69 |
| GET /review/queue | 63 | 2.19 | 4.21 | 3.52 | 6.08 | 6.64 | 10.5 | 10.5 |
| GET /notifications | 63 | 2.98 | 4.53 | 3.85 | 6.69 | 7.12 | 9.34 | 9.34 |
| GET /reports/governance | 62 | 3.44 | 7.09 | 6.76 | 9.44 | 11.89 | 15.95 | 15.95 |
