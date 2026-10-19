# Profile: smoke

**Description**: 1-2 Virtual Users, validating connectivity, authentication, health checks, and assertions

| Metric | Value |
|---|---|
| Concurrency | 2 virtual users |
| Duration | 10s |
| Total Requests | 175 |
| Successful Business Transactions | 175 |
| Expected Business Denials (RBAC 403) | 0 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 17.4 req/sec |
| Latency p50 | 5.24 ms |
| Latency p90 | 9.98 ms |
| Latency p95 | 12.08 ms |
| Latency p99 | 22.19 ms |
| Process Heap Memory | 9.7 MB |
| Process RSS Memory | 49.6 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /health | 30 | 1.92 | 3.16 | 2.27 | 5.62 | 5.71 | 6.46 | 6.46 |
| GET /ready | 29 | 4.22 | 7.27 | 6.04 | 10.32 | 14.98 | 23.33 | 23.33 |
| GET /search (Metadata & Text) | 29 | 3.55 | 6.36 | 6.45 | 10.71 | 11.31 | 11.91 | 11.91 |
| GET /documents/:id | 29 | 3.08 | 5 | 3.86 | 9.94 | 10.41 | 12.13 | 12.13 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 29 | 5.24 | 9.48 | 9.37 | 14.58 | 16.02 | 22.19 | 22.19 |
| GET /review/queue | 29 | 3.1 | 4.75 | 4.52 | 6.45 | 6.45 | 6.68 | 6.68 |
