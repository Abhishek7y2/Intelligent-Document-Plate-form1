# Profile: peak-load

**Description**: Simulated peak workload (30 VUs) measuring queue capacity, p95 latency, and worker throughput

| Metric | Value |
|---|---|
| Concurrency | 30 virtual users |
| Duration | 20.1s |
| Total Requests | 4611 |
| Successful Requests | 4433 |
| Errors | 178 (3.86%) |
| Throughput | 229.5 req/sec |
| Latency p50 | 7.98 ms |
| Latency p90 | 31.8 ms |
| Latency p95 | 67.12 ms |
| Latency p99 | 131.09 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 935 | 2.91 | 15.81 | 7.74 | 33.01 | 66.63 | 128.16 | 232.31 |
| GET /documents/:id | 929 | 2.45 | 15.94 | 7.36 | 31.25 | 69.18 | 142.33 | 233.25 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 922 | 3.01 | 15.48 | 8.82 | 28.5 | 56.65 | 123.18 | 232.97 |
| POST /qa/query (Grounded AI) | 916 | 3.42 | 15.78 | 8.33 | 27.87 | 64.22 | 130.08 | 222.63 |
| POST /documents/upload (Ack < 5s) | 909 | 2.69 | 16.77 | 7.92 | 41.14 | 75.38 | 137.33 | 232.46 |
