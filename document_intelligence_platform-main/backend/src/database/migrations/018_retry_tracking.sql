-- =============================================================================
-- Migration 018: Retry Tracking, Processing Attempts & Outbox Pipeline Events
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 3)
-- Target Engine: PostgreSQL 16 LTS
-- =============================================================================

-- 1. Document Retry Tracking Columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_retry 
    ON documents(tenant_id, status, retry_count);

-- 2. Expand Outbox Events Allowed Event Types
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_event_type_check;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_event_type_check 
    CHECK (event_type IN (
        'DOCUMENT_UPLOADED',
        'DOCUMENT_PUBLISHED',
        'INDEX_DOCUMENT_REQUESTED',
        'OCR_COMPLETED',
        'EXTRACTION_REQUESTED',
        'WEBHOOK_REQUESTED',
        'DOCUMENT_RETRY_REQUESTED'
    ));

-- 3. Document Processing Attempt Audit History Table
CREATE TABLE IF NOT EXISTS document_processing_attempts (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    stage VARCHAR(64) NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    succeeded BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processing_attempts_doc 
    ON document_processing_attempts(tenant_id, document_id, created_at DESC);
