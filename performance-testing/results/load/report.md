# Profile: normal-load

**Description**: Expected normal concurrent load (15 VUs) with realistic think time and full read/write workflow mix

| Metric | Value |
|---|---|
| Concurrency | 15 virtual users |
| Duration | 20.2s |
| Total Requests | 1769 |
| Successful Business Transactions | 1721 |
| Expected Business Denials (RBAC 403) | 48 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 87.8 req/sec |
| Latency p50 | 4.85 ms |
| Latency p90 | 10.02 ms |
| Latency p95 | 12.6 ms |
| Latency p99 | 21.69 ms |
| Process Heap Memory | 15.7 MB |
| Process RSS Memory | 84.9 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 259 | 2.33 | 5.03 | 4.13 | 7.62 | 9.79 | 20.11 | 21.81 |
| GET /documents/:id | 257 | 2.1 | 4.66 | 3.62 | 7.49 | 10.16 | 13.52 | 14.13 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 255 | 4.07 | 10.22 | 8.68 | 18.57 | 23.34 | 31.12 | 33.84 |
| POST /qa/query (Grounded AI) | 254 | 3.13 | 6 | 5.22 | 9.2 | 11.69 | 14.93 | 16.9 |
| POST /documents/upload (Ack < 5s) | 251 | 2.63 | 5.78 | 4.94 | 8.95 | 12.88 | 16.09 | 23.27 |
| GET /review/queue | 248 | 2.21 | 4.57 | 3.62 | 7.28 | 10.71 | 12.18 | 14.04 |
| GET /notifications | 245 | 2.09 | 4.66 | 4 | 7.42 | 8.65 | 12.44 | 13.62 |
