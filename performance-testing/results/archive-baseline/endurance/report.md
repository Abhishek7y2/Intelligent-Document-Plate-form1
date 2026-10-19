# Profile: endurance

**Description**: Sustained steady load (10 VUs) over 30 seconds to verify memory stability and latency drift absence

| Metric | Value |
|---|---|
| Concurrency | 10 virtual users |
| Duration | 30s |
| Total Requests | 2478 |
| Successful Requests | 2381 |
| Errors | 97 (3.91%) |
| Throughput | 82.5 req/sec |
| Latency p50 | 6.26 ms |
| Latency p90 | 10.7 ms |
| Latency p95 | 13.36 ms |
| Latency p99 | 367.57 ms |

### Endpoint / Transaction Breakdown

| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|---|
| GET /search (Metadata & Text) | 500 | 3.22 | 13.56 | 5.72 | 11.04 | 12.78 | 377.94 | 841.8 |
| GET /documents/:id | 497 | 2.29 | 11.28 | 5.38 | 9.92 | 13.36 | 333.84 | 840.51 |
| GET /compare?doc1=DOC-10245&doc2=v2 | 495 | 2.94 | 15.06 | 5.13 | 10.56 | 14.38 | 367.57 | 928.17 |
| POST /qa/query (Grounded AI) | 494 | 4.19 | 16.83 | 6.94 | 11.65 | 16.25 | 424.91 | 853.43 |
| POST /documents/upload (Ack < 5s) | 492 | 2.42 | 14.97 | 6.51 | 10.24 | 12.5 | 375.88 | 839.98 |
