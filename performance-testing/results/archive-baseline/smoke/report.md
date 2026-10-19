# Profile: smoke

**Description**: 1-2 Virtual Users, validating connectivity, authentication, health checks, and assertions

| Metric | Value |
|---|---|
| Concurrency | 2 virtual users |
| Duration | 10.1s |
| Total Requests | 173 |
| Successful Requests | 173 |
| Errors | 0 (0%) |
| Throughput | 17.2 req/sec |
| Latency p50 | 4.35 ms |
| Latency p90 | 8.69 ms |
| Latency p95 | 12.56 ms |
| Latency p99 | 24.88 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /health | 29 | 1.71 | 3.89 | 2.19 | 6.8 | 18.32 | 22.34 | 22.34 |
| GET /ready | 29 | 3.69 | 9.97 | 4.69 | 22.61 | 24.88 | 90.27 | 90.27 |
| GET /search (Metadata & Text) | 29 | 3.47 | 5.14 | 4.42 | 8.86 | 9.64 | 12.56 | 12.56 |
| GET /documents/:id | 29 | 3.23 | 4.75 | 4.4 | 6.11 | 8.69 | 9.4 | 9.4 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 29 | 3.97 | 5.38 | 4.63 | 6.75 | 8.63 | 16.91 | 16.91 |
| GET /review/queue | 28 | 3.17 | 4.77 | 4.06 | 9.25 | 9.87 | 10.1 | 10.1 |
