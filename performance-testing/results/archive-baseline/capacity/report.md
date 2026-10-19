# Profile: document-capacity

**Description**: 20-page document batch ingestion and async processing capacity (NFR-03 upload ack < 5s, NFR-04 processing within 5 mins)

| Metric | Value |
|---|---|
| Concurrency | 10 virtual users |
| Duration | 20.1s |
| Total Requests | 1582 |
| Successful Requests | 944 |
| Errors | 638 (40.33%) |
| Throughput | 78.7 req/sec |
| Latency p50 | 6.22 ms |
| Latency p90 | 25.9 ms |
| Latency p95 | 62.01 ms |
| Latency p99 | 154.46 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| POST /documents/upload (Ack < 5s) | 531 | 2.56 | 7.56 | 5.09 | 13.9 | 17.99 | 52.54 | 64.34 |
| POST /documents/:id/process-ocr (20-page) | 527 | 2.68 | 31.69 | 7.79 | 77.4 | 113.45 | 342.23 | 906.08 |
| GET /search (Metadata & Text) | 524 | 3.15 | 9.13 | 6.67 | 16.2 | 20.42 | 54.03 | 76.74 |
