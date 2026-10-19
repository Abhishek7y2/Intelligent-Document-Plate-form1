-- Migration: 023_review_edits_and_accuracy.sql
-- Description: Creates review_edits table for tracking human reviewer corrections and computing field extraction quality (FR-021 / F.2)

CREATE TABLE IF NOT EXISTS review_edits (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    reviewer_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_edits_tenant_type_field ON review_edits(tenant_id, document_type, field_key);
CREATE INDEX IF NOT EXISTS idx_review_edits_document ON review_edits(document_id);
