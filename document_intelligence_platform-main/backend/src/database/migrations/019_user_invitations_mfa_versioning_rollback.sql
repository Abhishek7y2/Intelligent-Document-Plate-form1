-- Rollback Migration 019: user_invitations, MFA columns, document_versions, source_version_id

BEGIN;

-- 1. Revert outbox_events check constraint
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS chk_outbox_event_type;
ALTER TABLE outbox_events ADD CONSTRAINT chk_outbox_event_type CHECK (
    event_type IN (
        'DOCUMENT_UPLOADED',
        'OCR_COMPLETED',
        'EXTRACTION_REQUESTED',
        'DOCUMENT_RETRY_REQUESTED',
        'WEBHOOK_REQUESTED',
        'DOCUMENT_PURGED',
        'AUDIT_LOG_RECORDED'
    )
);

-- 2. Revert document_extracted_fields changes
ALTER TABLE document_extracted_fields DROP CONSTRAINT IF EXISTS uq_doc_fields_version_key;
ALTER TABLE document_extracted_fields DROP CONSTRAINT IF EXISTS uq_doc_fields_version_id;
ALTER TABLE document_extracted_fields DROP CONSTRAINT IF EXISTS fk_doc_extracted_fields_version;
ALTER TABLE document_extracted_fields DROP COLUMN IF EXISTS source_version_id;
-- Restore original unique constraint
ALTER TABLE document_extracted_fields ADD CONSTRAINT document_extracted_fields_document_id_field_key_key UNIQUE (document_id, field_key);

-- 3. Drop document_versions table
DROP INDEX IF EXISTS idx_document_versions_tenant;
DROP INDEX IF EXISTS idx_document_versions_doc;
DROP TABLE IF EXISTS document_versions CASCADE;

-- 4. Revert MFA columns on users
DROP INDEX IF EXISTS idx_users_mfa_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_recovery_hashes;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret_enc;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;

-- 5. Drop user_invitations table
DROP INDEX IF EXISTS idx_user_invitations_lookup;
DROP INDEX IF EXISTS idx_user_invitations_token;
DROP TABLE IF EXISTS user_invitations CASCADE;

COMMIT;
