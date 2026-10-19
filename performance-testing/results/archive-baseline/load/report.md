# Profile: normal-load

**Description**: Expected normal concurrent load (15 VUs) with realistic think time and full read/write workflow mix

| Metric | Value |
|---|---|
| Concurrency | 15 virtual users |
| Duration | 20.2s |
| Total Requests | 1780 |
| Successful Requests | 1731 |
| Errors | 49 (2.75%) |
| Throughput | 88.3 req/sec |
| Latency p50 | 4.87 ms |
| Latency p90 | 7.74 ms |
| Latency p95 | 9.12 ms |
| Latency p99 | 14.85 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 260 | 2.47 | 5.18 | 4.81 | 7.58 | 9 | 15.95 | 17.13 |
| GET /documents/:id | 259 | 2.63 | 5.04 | 4.47 | 8.18 | 9.68 | 14.72 | 15.63 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 256 | 2.94 | 5.42 | 5.01 | 7.63 | 8.48 | 14.03 | 19.48 |
| POST /qa/query (Grounded AI) | 254 | 3.61 | 5.72 | 5.08 | 7.88 | 9.12 | 16.13 | 18 |
| POST /documents/upload (Ack < 5s) | 253 | 3.12 | 5.83 | 5.34 | 8.01 | 9.77 | 18.67 | 24.93 |
| GET /review/queue | 250 | 2.71 | 4.78 | 4.32 | 7.3 | 8.18 | 10.98 | 32.04 |
| GET /notifications | 248 | 2.6 | 5.15 | 4.72 | 7.57 | 8.78 | 12.14 | 13.79 |
