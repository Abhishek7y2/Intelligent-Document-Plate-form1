-- =============================================================================
-- Migration 019: User Invitations, TOTP MFA, and File Versioning
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 4)
-- Target Engine: PostgreSQL 16 LTS
-- =============================================================================

-- PART A: USER INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS user_invitations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    invited_by VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant_email 
    ON user_invitations(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token_hash 
    ON user_invitations(token_hash);

-- PART B: TOTP MFA COLUMNS ON USERS TABLE
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_hashes TEXT[] NULL DEFAULT '{}';

-- PART C: DOCUMENT VERSIONS TABLE (FR-015)
CREATE TABLE IF NOT EXISTS document_versions (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_document_versions_doc_ver UNIQUE (document_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_tenant_doc 
    ON document_versions(tenant_id, document_id, version_no DESC);

-- Backfill version 1 for every existing document from its current file_path and sha256_hash
INSERT INTO document_versions (id, document_id, tenant_id, version_no, storage_key, sha256_hash, is_current, created_by, created_at)
SELECT 
    'VER-' || d.document_id || '-1',
    d.document_id,
    d.tenant_id,
    1,
    d.file_path,
    d.sha256_hash,
    TRUE,
    d.assigned_to,
    COALESCE(d.uploaded_at, CURRENT_TIMESTAMP)
FROM documents d
ON CONFLICT (document_id, version_no) DO NOTHING;

-- Add source_version_id column to document_extracted_fields
ALTER TABLE document_extracted_fields 
    ADD COLUMN IF NOT EXISTS source_version_id VARCHAR(64) REFERENCES document_versions(id) ON DELETE CASCADE;

-- Backfill source_version_id to version 1
UPDATE document_extracted_fields def
SET source_version_id = dv.id
FROM document_versions dv
WHERE def.document_id = dv.document_id AND dv.version_no = 1 AND def.source_version_id IS NULL;

-- Remove older unique constraint and add composite constraint including source_version_id
ALTER TABLE document_extracted_fields DROP CONSTRAINT IF EXISTS document_extracted_fields_document_id_field_key_key;
ALTER TABLE document_extracted_fields DROP CONSTRAINT IF EXISTS uq_doc_fields_version_key;
ALTER TABLE document_extracted_fields ADD CONSTRAINT uq_doc_fields_version_key UNIQUE (document_id, field_key, source_version_id);

-- Update outbox_events check constraint to include DOCUMENT_REPLACED
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_event_type_check;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_event_type_check 
    CHECK (event_type IN (
        'DOCUMENT_UPLOADED',
        'DOCUMENT_PUBLISHED',
        'INDEX_DOCUMENT_REQUESTED',
        'OCR_COMPLETED',
        'EXTRACTION_REQUESTED',
        'WEBHOOK_REQUESTED',
        'DOCUMENT_RETRY_REQUESTED',
        'DOCUMENT_REPLACED'
    ));
