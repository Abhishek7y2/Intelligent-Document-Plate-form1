# Profile: stress

**Description**: Above-peak stress workload (50 VUs) determining degradation points and service recovery

| Metric | Value |
|---|---|
| Concurrency | 50 virtual users |
| Duration | 20.1s |
| Total Requests | 4492 |
| Successful Business Transactions | 4320 |
| Expected Business Denials (RBAC 403) | 172 |
| Genuine System Failures (5xx/Timeouts) | 0 |
| Genuine Failure Rate (Authorized) | **0%** |
| Throughput | 223.7 req/sec |
| Latency p50 | 114.35 ms |
| Latency p90 | 277.89 ms |
| Latency p95 | 314.93 ms |
| Latency p99 | 555.49 ms |
| Process Heap Memory | 25.4 MB |
| Process RSS Memory | 114.6 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 924 | 3.08 | 107.3 | 104.74 | 154.78 | 188.84 | 271.71 | 566.46 |
| GET /documents/:id | 910 | 2.47 | 112.84 | 106.09 | 163.19 | 217.87 | 548.08 | 558.2 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 902 | 4.04 | 277.22 | 273.66 | 407.81 | 503.38 | 754.55 | 777.34 |
| POST /qa/query (Grounded AI) | 880 | 3.83 | 108.59 | 105.99 | 153.32 | 186.55 | 265.38 | 556.49 |
| POST /documents/upload (Ack < 5s) | 876 | 2.71 | 112.23 | 108.11 | 157.81 | 189 | 272.74 | 583.52 |
