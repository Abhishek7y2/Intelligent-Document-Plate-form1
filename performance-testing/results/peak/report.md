# Profile: peak-load

**Description**: Simulated peak workload (30 VUs) measuring queue capacity, p95 latency, and worker throughput

| Metric | Value |
|---|---|
| Concurrency | 30 virtual users |
| Duration | 20.1s |
| Total Requests | 4509 |
| Successful Business Transactions | 4335 |
| Expected Business Denials (RBAC 403) | 174 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 224.2 req/sec |
| Latency p50 | 11.35 ms |
| Latency p90 | 39.84 ms |
| Latency p95 | 60.57 ms |
| Latency p99 | 103.45 ms |
| Process Heap Memory | 19.3 MB |
| Process RSS Memory | 87.6 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 914 | 2.44 | 13.87 | 9.47 | 26.72 | 39.61 | 88.42 | 115.67 |
| GET /documents/:id | 908 | 2.02 | 13.21 | 7.36 | 27.4 | 39.74 | 94.95 | 120.07 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 907 | 4.06 | 35.25 | 25.9 | 70.6 | 98.44 | 176.8 | 252.13 |
| POST /qa/query (Grounded AI) | 894 | 3.61 | 15.31 | 11.53 | 26.61 | 36.19 | 85.63 | 124.18 |
| POST /documents/upload (Ack < 5s) | 886 | 2.68 | 13.4 | 8.19 | 27.08 | 40.83 | 78.92 | 89.64 |
