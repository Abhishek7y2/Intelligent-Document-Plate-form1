# Profile: endurance

**Description**: Sustained steady load (10 VUs) over 60 seconds to verify memory stability, connection pool health, and latency drift absence

| Metric | Value |
|---|---|
| Concurrency | 10 virtual users |
| Duration | 60.1s |
| Total Requests | 5095 |
| Successful Business Transactions | 4893 |
| Expected Business Denials (RBAC 403) | 202 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 84.8 req/sec |
| Latency p50 | 5.77 ms |
| Latency p90 | 12.96 ms |
| Latency p95 | 16.55 ms |
| Latency p99 | 26.63 ms |
| Process Heap Memory | 27 MB |
| Process RSS Memory | 117.1 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 1022 | 2.75 | 9.22 | 5.69 | 10.48 | 12.39 | 21.52 | 2761.28 |
| GET /documents/:id | 1020 | 1.88 | 12.82 | 3.76 | 8.29 | 12.36 | 18.13 | 2772.38 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 1020 | 3.57 | 19.56 | 9.71 | 20.02 | 24.71 | 44.62 | 2820.24 |
| POST /qa/query (Grounded AI) | 1018 | 4.03 | 8.65 | 7.79 | 13.44 | 16.09 | 21.72 | 28.37 |
| POST /documents/upload (Ack < 5s) | 1015 | 2.46 | 13.06 | 4.13 | 7.62 | 9.7 | 16 | 2795.36 |
