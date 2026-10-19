-- =============================================================================
-- Migration 012: Grounded Q&A Traces, Audit Logs, and Citation Tracking
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 10)
-- Target Engine: PostgreSQL 16 LTS with pgvector
-- =============================================================================

CREATE TABLE IF NOT EXISTS qa_traces (
    trace_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64),
    document_id VARCHAR(64) REFERENCES documents(document_id) ON DELETE SET NULL,
    question_hash VARCHAR(64) NOT NULL,
    question_sanitized TEXT NOT NULL,
    answer_snippet TEXT,
    status VARCHAR(32) NOT NULL CHECK (status IN ('ANSWERED', 'ABSTAINED', 'CONFLICT_DETECTED', 'INSUFFICIENT_EVIDENCE', 'SECURITY_BLOCKED', 'ERROR')),
    abstention_reason TEXT,
    confidence_score NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    model_name VARCHAR(64) NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    duration_ms INT NOT NULL DEFAULT 0,
    correlation_id VARCHAR(64),
    feedback VARCHAR(32) CHECK (feedback IN ('HELPFUL', 'NOT_HELPFUL', 'FLAGGED') OR feedback IS NULL),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qa_traces_tenant_user 
    ON qa_traces(tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_traces_document 
    ON qa_traces(document_id);

CREATE TABLE IF NOT EXISTS qa_citations (
    citation_id VARCHAR(64) PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL REFERENCES qa_traces(trace_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    source_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    page_number INT NOT NULL DEFAULT 1,
    section_reference VARCHAR(128),
    evidence_span_id VARCHAR(64),
    evidence_snippet TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qa_citations_trace 
    ON qa_citations(trace_id);

CREATE INDEX IF NOT EXISTS idx_qa_citations_doc 
    ON qa_citations(tenant_id, document_id);
