# DocuNexa Sprint 9 — Implementation Plan: Semantic Search, Vector Indexing & Version Comparison Studio

**Version:** 1.0 — Approved Plan  
**Target:** Sprint 9 (Repository, Search & Clause Compare)  
**Roles:** Principal Search Engineer, PostgreSQL/pgvector Specialist, Document Intelligence Architect, Security Reviewer, Lead QA Engineer  
**Baseline:** Sprint 8 CONDITIONAL PASS (266/266 backend tests passed across 24 suites, 17/17 frontend tests passed across 4 suites, clean TypeScript and Angular builds, PostgreSQL 16 sandbox on port 5434 blocked, legacy PostgreSQL 12.12 on port 5433 untouched).

---

## 1. Executive Summary & Sprint Scope Boundaries

Sprint 9 implements **Enterprise Semantic Search, Vector Indexing with pgvector, and Document Version Comparison Studio** for DocuNexa. It provides multi-modal discovery across indexed document text and structured fields, and automated clause-level and field-level redlining between document versions.

### Approved In-Scope Boundaries:
1. **Vector Indexing Pipeline**:
   - Extraction of validated OCR text and structured page layouts from processed documents.
   - Token-aware, sliding-window chunking strategy with page and spatial bounding-box provenance.
   - Embedding generation producing 1536-dimensional vectors conforming strictly to **ADR-002**.
   - Modular embedding provider interface (`IEmbeddingProvider`) supporting both live provider adapters (`OpenAiCompatibleEmbeddingProvider`) and deterministic mock/fallback providers (`SyntheticEmbeddingProvider`) for air-gapped or test environments.
   - Idempotent indexing and re-indexing pipeline (`indexDocument`, `reindexDocument`, `deleteDocumentIndex`) that guarantees safe updates and prevents duplicate chunks.
   - Document lifecycle synchronization: Handling superseded versions, quarantined documents, and document deletion.
2. **Hybrid & Semantic Retrieval Engine**:
   - Multi-tenant, authorized search API (`GET /api/v1/search` and `POST /api/v1/search`).
   - Hybrid retrieval combining vector similarity (cosine distance `<=>`) and PostgreSQL full-text search (`tsvector` / `tsquery`).
   - Multi-facet filtering (document type, status, vendor/supplier, date range, confidence score, monetary amount).
   - Highlighted text snippets and verbatim source citations (document ID, page number, paragraph/chunk index).
   - Strict tenant boundary isolation preventing any cross-tenant metadata or vector leakage.
3. **Document Version Comparison Studio**:
   - Dual-document version selection and authorization (`POST /api/v1/compare` and `GET /api/v1/compare`).
   - Text and clause-level difference engine using deterministic sequence diffing to compute `added`, `removed`, `modified`, and `unchanged` chunks.
   - Risk classification engine identifying contract risk shifts (e.g., uncapped liability, payment term changes, auto-renewal, data protection) with risk levels (`High`, `Medium`, `Low`, `None`).
   - Structured field variance comparison (comparing extracted key-value fields across versions).
   - Tamper-evident audit logging of comparison actions with SHA-256 signatures.
4. **Angular 19 Frontend Integration**:
   - `HttpSearchService` implementing `ISearchService` and replacing client-side mock searching.
   - `HttpCompareService` implementing `ICompareService` and connecting `CompareStudio` to backend comparison APIs.
   - Connected search cards, facets, and side-by-side redline viewers.

### Explicit Out-of-Scope (Strict Guardrails):
- **Sprint 10 Scope Deferred**: Grounded Conversational Q&A (RAG pipeline, prompt injection defense, conversational citation chat assistant).
- **Port 5433 Host Safety**: Existing PostgreSQL 12.12 cluster on port 5433 remains strictly protected and untouched. No migrations or vector DDL will be executed against port 5433.
- **Port 5434 PostgreSQL 16 Integration**: Dedicated sandbox remains marked **BLOCKED** until provisioned. Memory-backed fallback is provided for isolated automated unit tests.

---

## 2. Requirements-to-API-to-Database-to-Test Traceability Matrix

| BRD / FR Requirement | Feature Component | Backend Service & Controller | Schema / Persistence | Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **BRD-REQ-014** / **FR-014** | Semantic & Hybrid Search | `SearchService.search()`<br>`SearchController.searchHandler` | `document_chunks`<br>`documents` | `search.service.spec.ts`<br>`search.controller.spec.ts` |
| **ADR-002** / **FR-020** | 1536-dim Vector Indexing | `EmbeddingService.generateEmbedding()`<br>`SearchService.indexDocument()` | `document_chunks.embedding`<br>`vector(1536)` HNSW | `embedding.service.spec.ts`<br>`search.service.spec.ts` |
| **FR-014-FACET** | Multi-Facet Search Filtering | `SearchService.search()` | `documents.document_type`<br>`documents.status` | `search.service.spec.ts`<br>`search.controller.spec.ts` |
| **FR-014-SEC** | Tenant-Isolated Retrieval | `SearchService.search()`<br>`enforceTenantIsolation` | `document_chunks.tenant_id`<br>`idx_chunks_tenant` | `search.service.spec.ts`<br>`search.controller.spec.ts` |
| **BRD-REQ-012** / **FR-012** | Version Comparison Studio | `CompareService.compareDocuments()`<br>`CompareController.compareHandler` | `document_comparisons`<br>`document_extractions` | `compare.service.spec.ts`<br>`compare.controller.spec.ts` |
| **FR-012-DIFF** | Clause & Text Redlining | `CompareService.computeTextDiff()`<br>`CompareService.alignClauses()` | `document_comparisons.diff_payload` | `compare.service.spec.ts` |
| **FR-012-RISK** | Risk Assessment & Delta | `CompareService.classifyRisk()` | `ClauseDiff.riskImpact` | `compare.service.spec.ts` |
| **UI-SCR-07** | Angular Search Integration | `HttpSearchService`<br>`Search` Component | Angular REST Client | `http-search.service.spec.ts`<br>`search.spec.ts` |
| **UI-SCR-08** | Angular Compare Integration | `HttpCompareService`<br>`CompareStudio` Component | Angular REST Client | `http-compare.service.spec.ts` |

---

## 3. Architecture & Data Contracts

### 3.1 Vector Indexing & Chunking Strategy
- **Chunking Parameters**:
  - Strategy: Paragraph-aware sliding window over document OCR text and page geometry.
  - Chunk Size: Max 500 characters (~100 tokens), with 50-character overlap.
  - Spatial Anchor: Preserves `pageNumber` and representative bounding box (`BoundingBox2D`).
- **Vector Specification**:
  - Dimensions: **1536** (conforming to ADR-002 and standard embedding dimensionality).
  - Distance Metric: Cosine Distance (`<=>`).
  - Index Type: HNSW (`m = 16, ef_construction = 64`).
- **Freshness & Invalidation**:
  - When a document is re-indexed or updated, all existing chunks matching `(tenant_id, document_id)` are deleted before inserting the new chunk set.
  - Quarantined (`status = 'QUARANTINED'`), failed (`status = 'FAILED'`), or deleted documents are filtered out of all retrieval queries.

### 3.2 Search API Contract
- `GET /api/v1/search?q={query}&type={type}&status={status}&page={page}&pageSize={pageSize}`
- `POST /api/v1/search`
```json
{
  "query": "Net 30 payment terms and liability cap",
  "filters": {
    "documentType": "Supplier Contract",
    "status": "APPROVED",
    "startDate": "2026-01-01",
    "endDate": "2026-10-12",
    "minAmount": 10000,
    "maxAmount": 5000000
  },
  "limit": 10,
  "offset": 0
}
```
**Response (200 OK)**:
```json
{
  "query": "Net 30 payment terms and liability cap",
  "totalMatches": 2,
  "results": [
    {
      "docId": "DOC-10248",
      "title": "Supplier Agreement - Acme Industries",
      "category": "Supplier Contract",
      "status": "APPROVED",
      "matchScore": 0.94,
      "pageNumber": 3,
      "snippet": "Maximum Liability & Penalty Cap is limited to 100% of Total Contract Value...",
      "highlightedSnippet": "Maximum <mark>Liability & Penalty Cap</mark> is limited to 100%...",
      "sourceVersion": "v1.0",
      "updatedAt": "2026-10-07T12:00:00Z"
    }
  ],
  "facets": {
    "byType": { "Supplier Contract": 1, "Purchase Invoice": 1 },
    "byStatus": { "APPROVED": 2 }
  }
}
```

### 3.3 Version Comparison Contract
- `POST /api/v1/compare`
```json
{
  "documentId1": "DOC-10245-v1",
  "documentId2": "DOC-10245-v2"
}
```
**Response (200 OK)**:
```json
{
  "comparisonId": "CMP-8712",
  "document1": { "id": "DOC-10245-v1", "name": "Vendor Master Agreement v1.0", "version": "v1.0" },
  "document2": { "id": "DOC-10245-v2", "name": "Vendor Master Agreement v2.0", "version": "v2.0" },
  "summary": {
    "totalClauses": 4,
    "addedCount": 1,
    "removedCount": 1,
    "modifiedCount": 2,
    "highRiskCount": 1
  },
  "clauses": [
    {
      "id": "CL-1",
      "sectionNumber": "2.0",
      "title": "Liability & Damage Cap",
      "category": "commercial",
      "changeType": "modified",
      "version1Text": "Total aggregate liability shall be capped strictly at 100%...",
      "version2Text": "Total aggregate liability shall be uncapped for gross negligence...",
      "riskImpact": "High",
      "plainEnglishImpact": "CRITICAL SHIFT: Safety cap removed; unlimited liability exposure.",
      "legalRecommendation": "🚨 HIGH RISK: Reject or propose a 2x cap.",
      "pageCitationV1": "v1.0 Page 5",
      "pageCitationV2": "v2.0 Page 6",
      "v1Chunks": [...],
      "v2Chunks": [...],
      "unifiedChunks": [...]
    }
  ],
  "fieldDiffs": [
    {
      "fieldKey": "paymentTerms",
      "label": "Payment Terms",
      "v1Value": "Net 45 Days",
      "v2Value": "Net 30 Days",
      "status": "Modified",
      "varianceImpact": "Accelerated Cash Outflow (-15 Days)",
      "plainMeaning": "Disbursement schedule shortened by 15 days."
    }
  ]
}
```

---

## 4. PostgreSQL 16 & pgvector Database Migration Plan

We introduce **Migration 010**: `backend/src/database/migrations/010_semantic_search_and_version_compare.sql`.
- Extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Tables:
  1. `document_chunks`:
     - `chunk_id` UUID PRIMARY KEY
     - `document_id` VARCHAR(64) REFERENCES documents(document_id)
     - `tenant_id` VARCHAR(64) REFERENCES tenants(tenant_id)
     - `chunk_index` INT NOT NULL
     - `source_version` VARCHAR(32) NOT NULL DEFAULT 'v1.0'
     - `page_number` INT NOT NULL DEFAULT 1
     - `bounding_box` JSONB
     - `chunk_text` TEXT NOT NULL
     - `tsv_vector` TSVECTOR
     - `embedding` vector(1536)
     - `created_at` TIMESTAMPTZ DEFAULT NOW()
  2. Indexes:
     - `idx_chunks_tenant_doc`: `(tenant_id, document_id)`
     - `idx_chunks_tsv`: GIN on `tsv_vector`
     - `idx_chunks_hnsw`: HNSW on `embedding vector_cosine_ops` WITH `(m = 16, ef_construction = 64)`
  3. `document_comparisons`:
     - `comparison_id` VARCHAR(64) PRIMARY KEY
     - `tenant_id` VARCHAR(64) REFERENCES tenants(tenant_id)
     - `base_doc_id` VARCHAR(64) REFERENCES documents(document_id)
     - `target_doc_id` VARCHAR(64) REFERENCES documents(document_id)
     - `diff_summary` JSONB NOT NULL
     - `diff_payload` JSONB NOT NULL
     - `created_at` TIMESTAMPTZ DEFAULT NOW()

---

## 5. Security Guardrails & Tenant Isolation
1. **Host Database Protection**: Host PostgreSQL 12.12 on port 5433 remains untouched.
2. **PostgreSQL 16 Sandbox**: Port 5434 remains marked BLOCKED. Safe in-memory store mode (`storeMode = 'memory' | 'database'`) handles automated Jest tests without depending on the unprovisioned container.
3. **Mandatory Tenant Fence**: Every search query and comparison request validates that caller `tenant_id` strictly matches the documents and chunks. Cross-tenant retrieval returns empty results or 403 Forbidden.

---

## 6. Testing & Evaluation Criteria
1. **Embedding Unit Tests**: Vector dimension validation (1536 dims), cosine similarity math, error handling on malformed vector.
2. **Indexing Unit Tests**: Idempotency (re-indexing clears old chunks), chunk creation with page numbers, skipping quarantined documents.
3. **Search Unit Tests**: Query relevance ranking, keyword/exact matching vs vector similarity, multi-facet filtering, tenant isolation.
4. **Compare Studio Unit Tests**: Clause diffing (`added`, `removed`, `modified`, `unchanged`), risk classification, field diffs, incomparable documents rejection.
5. **Frontend Services**: `HttpSearchService` and `HttpCompareService` tested with `HttpClientTestingModule` / `HttpTestingController`.
