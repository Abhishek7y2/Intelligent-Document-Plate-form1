-- =============================================================================
-- Migration 011: Transactional Outbox Events for Reliable Publication and Asynchronous Indexing
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 9 Remediation)
-- Target Engine: PostgreSQL 16 LTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    event_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN ('DOCUMENT_PUBLISHED', 'INDEX_DOCUMENT_REQUESTED')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_claimable 
    ON outbox_events(tenant_id, status, created_at ASC)
    WHERE status IN ('PENDING', 'PROCESSING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_outbox_document 
    ON outbox_events(document_id);
