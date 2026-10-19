# Profile: spike

**Description**: Sudden spike of 60 VUs with rapid 1s ramp-up to evaluate surge handling and queue draining

| Metric | Value |
|---|---|
| Concurrency | 60 virtual users |
| Duration | 15.1s |
| Total Requests | 4429 |
| Successful Business Transactions | 4429 |
| Expected Business Denials (RBAC 403) | 0 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 293.1 req/sec |
| Latency p50 | 113.21 ms |
| Latency p90 | 273.45 ms |
| Latency p95 | 305.64 ms |
| Latency p99 | 363.78 ms |
| Process Heap Memory | 17.8 MB |
| Process RSS Memory | 117.7 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 1498 | 3.33 | 95.93 | 94.08 | 141.95 | 158.6 | 191.67 | 205.74 |
| GET /documents/:id | 1466 | 2.41 | 95.55 | 93.63 | 139.32 | 150.27 | 179.53 | 207.18 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 1465 | 4.53 | 245.46 | 241.58 | 321.89 | 352.63 | 387.65 | 442.49 |
