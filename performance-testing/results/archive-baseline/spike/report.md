# Profile: spike

**Description**: Sudden spike of 60 VUs with rapid 1s ramp-up to evaluate surge handling and queue draining

| Metric | Value |
|---|---|
| Concurrency | 60 virtual users |
| Duration | 15.1s |
| Total Requests | 3054 |
| Successful Requests | 3054 |
| Errors | 0 (0%) |
| Throughput | 201.9 req/sec |
| Latency p50 | 188.12 ms |
| Latency p90 | 415.14 ms |
| Latency p95 | 494.55 ms |
| Latency p99 | 584.42 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 1035 | 3.46 | 234 | 188.52 | 409.25 | 491.85 | 585.42 | 609.29 |
| GET /documents/:id | 1020 | 2.8 | 230.09 | 183.43 | 413.16 | 494.55 | 581.99 | 725.83 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 999 | 3.55 | 239.79 | 195.64 | 421.56 | 497.21 | 589.17 | 700.17 |
