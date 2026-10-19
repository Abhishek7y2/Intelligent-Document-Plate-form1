-- =============================================================================
-- Migration 010: Semantic Search, Vector Indexing (pgvector) & Version Compare
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 9)
-- Target Engine: PostgreSQL 16 LTS with pgvector extension
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Document Chunks & 1536-dimensional Vector Embeddings Table (ADR-002, FR-014, FR-020)
CREATE TABLE IF NOT EXISTS document_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    source_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    page_number INT NOT NULL DEFAULT 1,
    bounding_box JSONB,
    chunk_text TEXT NOT NULL,
    tsv_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doc_chunk_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_doc 
    ON document_chunks(tenant_id, document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_tsv 
    ON document_chunks USING gin(tsv_vector);

CREATE INDEX IF NOT EXISTS idx_chunks_hnsw 
    ON document_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 2. Document Comparisons Table (FR-012 Document Version Comparison Studio)
CREATE TABLE IF NOT EXISTS document_comparisons (
    comparison_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    base_document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    target_document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    summary JSONB NOT NULL,
    clauses JSONB NOT NULL,
    field_diffs JSONB NOT NULL,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comparisons_tenant 
    ON document_comparisons(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comparisons_docs 
    ON document_comparisons(base_document_id, target_document_id);
