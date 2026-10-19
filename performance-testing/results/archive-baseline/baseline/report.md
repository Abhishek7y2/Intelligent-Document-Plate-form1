# Profile: baseline

**Description**: Low concurrency (5 VUs) establishing normal response times, throughput, and error rate

| Metric | Value |
|---|---|
| Concurrency | 5 virtual users |
| Duration | 15s |
| Total Requests | 449 |
| Successful Requests | 449 |
| Errors | 0 (0%) |
| Throughput | 29.8 req/sec |
| Latency p50 | 4.51 ms |
| Latency p90 | 8.08 ms |
| Latency p95 | 9.92 ms |
| Latency p99 | 13.02 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 67 | 3.1 | 5.13 | 4.45 | 8.11 | 9.86 | 13.15 | 13.15 |
| GET /documents/:id | 65 | 2.98 | 5.04 | 4.21 | 7.98 | 9.99 | 14.58 | 14.58 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 65 | 3.3 | 5.67 | 4.96 | 9.92 | 10.69 | 14.57 | 14.57 |
| POST /qa/query (Grounded AI) | 64 | 3.83 | 5.83 | 5.09 | 8.38 | 10.03 | 15.04 | 15.04 |
| GET /review/queue | 63 | 2.71 | 4.85 | 4.08 | 7.8 | 9.53 | 13.02 | 13.02 |
| GET /notifications | 63 | 3 | 4.73 | 3.88 | 7.75 | 8 | 11.51 | 11.51 |
| GET /reports/governance | 62 | 2.85 | 4.87 | 4.32 | 6.81 | 7.81 | 11.67 | 11.67 |
