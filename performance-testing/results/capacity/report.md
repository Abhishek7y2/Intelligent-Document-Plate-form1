# Profile: document-capacity

**Description**: 20-page document batch ingestion and async processing capacity (NFR-03 upload ack < 5s, NFR-04 processing within 5 mins)

| Metric | Value |
|---|---|
| Concurrency | 10 virtual users |
| Duration | 20.5s |
| Total Requests | 1575 |
| Successful Business Transactions | 1345 |
| Expected Business Denials (RBAC 403) | 115 |
| Genuine System Failures (5xx/Timeouts) | 115 |
| Genuine Failure Rate (Authorized) | **7.88%** |
| Throughput | 76.9 req/sec |
| Latency p50 | 4.61 ms |
| Latency p90 | 8.3 ms |
| Latency p95 | 9.82 ms |
| Latency p99 | 18.07 ms |
| Process Heap Memory | 18.7 MB |
| Process RSS Memory | 118.7 MB |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| POST /documents/upload (Ack < 5s) | 528 | 2.28 | 5.09 | 4.37 | 7.72 | 8.93 | 12.42 | 17.94 |
| POST /documents/:id/process-ocr (20-page) | 526 | 2.66 | 42.94 | 4.13 | 7.97 | 9.6 | 1423.59 | 1995.57 |
| GET /search (Metadata & Text) | 521 | 3.53 | 6.11 | 5.29 | 9.4 | 10.62 | 14.25 | 18.07 |
