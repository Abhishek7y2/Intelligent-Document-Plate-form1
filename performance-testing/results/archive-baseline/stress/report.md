# Profile: stress

**Description**: Above-peak stress workload (50 VUs) determining degradation points and service recovery

| Metric | Value |
|---|---|
| Concurrency | 50 virtual users |
| Duration | 25s |
| Total Requests | 4434 |
| Successful Requests | 4261 |
| Errors | 173 (3.9%) |
| Throughput | 177.4 req/sec |
| Latency p50 | 121.83 ms |
| Latency p90 | 242.39 ms |
| Latency p95 | 408.07 ms |
| Latency p99 | 5338.5 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 908 | 2.94 | 216.52 | 122.57 | 252.8 | 451.73 | 5349.94 | 5727.4 |
| GET /documents/:id | 895 | 2.34 | 182.62 | 120.26 | 229.84 | 350.34 | 813.24 | 5730.97 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 887 | 2.98 | 203.97 | 121.16 | 247.3 | 408.97 | 5342.25 | 5729.69 |
| POST /qa/query (Grounded AI) | 876 | 3.75 | 190.25 | 124.42 | 250.23 | 404.54 | 806.19 | 5724.45 |
| POST /documents/upload (Ack < 5s) | 868 | 2.93 | 200.77 | 121.12 | 230.15 | 395.92 | 5352.21 | 5729.79 |
