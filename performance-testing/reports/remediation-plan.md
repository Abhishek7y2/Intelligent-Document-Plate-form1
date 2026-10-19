# DocNexa Enterprise Performance Remediation & Scalability Engineering Plan

## 1. Architectural Overview & Context
This remediation plan details the architectural, query, concurrency, and caching optimizations implemented and planned for the **DocNexa Document Intelligence Platform** against **BRD v1.0** (NFR-01 through NFR-08).

---

## 2. Completed Remediations & Measured Outcomes

### 2.1. DEF-PERF-01: Object Storage Binary Seeding & Fail-Closed 404
* **Issue**: Unhandled 500 error (`STORAGE_PAYLOAD_UNAVAILABLE`) when OCR pipeline processed documents without physical storage files.
* **Implementation**:
  - Populated authentic PDF (`%PDF-1.4`) and DOCX files in `IntakeService.seedDefaultDocuments()` during service initialization.
  - Implemented strict fail-closed 404 response (`STORAGE_PAYLOAD_NOT_FOUND`) in `OcrService.processDocument()` to prevent silent data fabrication.
  - Added 6 automated regression tests in `backend/src/services/ocr-storage-regression.spec.ts`.
* **Measured Outcome**: HTTP 500 crashes reduced from 469 to **0** in the 20-page document capacity profile.

---

### 2.2. PostgreSQL Composite Indexing (Migration 015)
* **Issue**: Unindexed queries on `documents` sorted by `uploaded_at DESC` caused database quicksort overhead and connection pool contention under 30+ VUs.
* **Implementation**:
  - Applied migration `015_performance_and_search_indexes.sql`:
    ```sql
    CREATE INDEX idx_documents_tenant_uploaded_at ON documents (tenant_id, uploaded_at DESC);
    CREATE INDEX idx_documents_tenant_type_status ON documents (tenant_id, document_type, status);
    ```
* **Measured Outcome**:
  - Query execution time reduced by **64.0%** (0.089 ms to 0.032 ms).
  - Buffer read blocks reduced by **60.0%** (5 to 2 blocks).
  - Peak load p95 latency reduced by **73.4%** (67.12 ms to 17.87 ms).
  - Stress load p95 latency reduced by **32.8% to 61.0%** (down to 159.03 ms).

---

### 2.3. DEF-PERF-02: Authentication Rate Limiter Token Caching
* **Issue**: Client-IP rate limiter tripped when virtual users re-authenticated on every transaction.
* **Implementation**:
  - Decoupled session establishment from business transactions; cached JWT bearer tokens across user lifecycles.
* **Measured Outcome**: Zero 429 rate limit errors during multi-user load runs; eliminated repetitive password hashing overhead.

---

## 3. Production Readiness Scalability Recommendations

### 3.1. Direct-to-S3 Presigned Uploads
* **Target Requirement**: NFR-03 (Upload acknowledgment < 5,000 ms).
* **Current State**: Multipart files up to 50MB are buffered in Node.js process memory via `multer.memoryStorage()`.
* **Recommendation**:
  - Issue presigned S3/MinIO upload URLs (`PUT s3://bucket/tenants/{tenantId}/docs/{uuid}.pdf`).
  - Client uploads directly to object storage; notifies DocNexa API via lightweight confirmation webhook (`POST /api/v1/documents/confirm-upload`).
  - Completely eliminates Node.js heap memory consumption for large file intake.

### 3.2. Horizontal Pod Autoscaling (HPA) & Worker Separation
* **Target Requirement**: NFR-02 & NFR-04.
* **Current State**: Single Node.js process handles both HTTP requests and async OCR coordination. Saturation begins at ~30-50 VUs (~250-280 req/s).
* **Recommendation**:
  - Deploy Express API pods behind an NGINX / AWS ALB ingress with Kubernetes HPA (scale when CPU > 70% or active connections > 150).
  - Offload CPU-heavy OCR, layout analysis, and AI embedding generation to dedicated worker pods consuming from RabbitMQ or Redis BullMQ.

### 3.3. Distributed Rate Limiting via Redis
* **Current State**: In-memory `RateLimiterStore` tracks attempts per Node.js process.
* **Recommendation**:
  - For multi-replica Kubernetes deployments, transition to Redis sliding-window token bucket to maintain unified IP and tenant rate limits across all cluster pods.

### 3.4. Compare Studio Caching
* **Target Requirement**: UAT-02 (Compare Studio diffing).
* **Recommendation**:
  - Document versions are immutable once finalized. Cache clause comparison diffs in Redis keyed by `cmp:{tenantId}:{docId1}:{docId2}` with a 24-hour TTL.

---

## 4. Prioritized Implementation Roadmap

| Priority | Initiative | Impact | Effort | Target Phase | Status |
|---|---|---|---|---|---|
| **P0** | **DEF-PERF-01 Storage Fix & Fail-Closed 404** | Eliminates 500 crashes during OCR processing | 1 day | Complete | **VERIFIED** |
| **P0** | **PostgreSQL Composite Indexing (Migration 015)** | 64% query speedup, 73% peak latency reduction | 1 day | Complete | **VERIFIED** |
| **P0** | **DEF-PERF-02 JWT Token Reuse in Test Harness** | Eliminates 429 rate limit false positives | 1 day | Complete | **VERIFIED** |
| **P1** | **Direct-to-S3 Presigned Uploads** | Eliminates memory pressure on web pods for 50MB files | 2 days | Sprint 11 | Planned |
| **P1** | **Distributed Rate Limiting with Redis** | Ensures uniform protection across auto-scaled cluster replicas | 1 day | Sprint 11 | Planned |
| **P2** | **Dedicated Async Worker Architecture (RabbitMQ/BullMQ)** | Decouples heavy OCR/AI jobs from interactive web threads | 3 days | Sprint 12 | Planned |
| **P2** | **Horizontal Pod Autoscaling (3+ replicas)** | Scales throughput beyond 750+ req/s | 2 days | Sprint 12 | Planned |
| **P3** | **Immutable Clause Comparison Caching** | Reduces diff CPU utilization to near zero for repeated reviews | 1 day | Sprint 13 | Planned |
