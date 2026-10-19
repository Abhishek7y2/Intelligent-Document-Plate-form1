-- =============================================================================
-- Migration 020: MongoDB Derived Collections Support, AI-007 Document Summaries,
-- and Email Intake Mailbox Tables
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 5)
-- Target Engine: PostgreSQL 16 LTS
-- All identifiers use VARCHAR(64) matching existing core entities
-- =============================================================================

BEGIN;

-- 1. DOCUMENT SUMMARIES (AI-007)
CREATE TABLE IF NOT EXISTS document_summaries (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    source_version_id VARCHAR(64) REFERENCES document_versions(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'ABSTAINED')),
    model_version VARCHAR(64) NOT NULL,
    created_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    corrected_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_summaries_tenant_doc 
    ON document_summaries(tenant_id, document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_source_ver 
    ON document_summaries(source_version_id);

-- 2. SUMMARY CORRECTIONS (Audit history for reviewer corrections)
CREATE TABLE IF NOT EXISTS summary_corrections (
    id VARCHAR(64) PRIMARY KEY,
    summary_id VARCHAR(64) NOT NULL REFERENCES document_summaries(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    previous_summary TEXT NOT NULL,
    corrected_summary TEXT NOT NULL,
    reviewer_id VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    reason TEXT,
    corrected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_summary_corrections_tenant_sum 
    ON summary_corrections(tenant_id, summary_id, corrected_at DESC);

-- 3. INTAKE MAILBOXES (FR-004, GAP-004)
CREATE TABLE IF NOT EXISTS intake_mailboxes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL UNIQUE,
    allowed_sender_domains TEXT[] NOT NULL DEFAULT '{}',
    default_uploader_user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_mailboxes_tenant 
    ON intake_mailboxes(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_intake_mailboxes_address 
    ON intake_mailboxes(address);

-- 4. PROCESSED EMAILS (Idempotency and deduplication by Message-ID)
CREATE TABLE IF NOT EXISTS processed_emails (
    id VARCHAR(64) PRIMARY KEY,
    mailbox_id VARCHAR(64) NOT NULL REFERENCES intake_mailboxes(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    outcome VARCHAR(64) NOT NULL,
    details JSONB,
    CONSTRAINT uq_processed_emails_mailbox_msg UNIQUE (mailbox_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_emails_mailbox 
    ON processed_emails(mailbox_id, processed_at DESC);

-- 5. UPDATE OUTBOX_EVENTS CHECK CONSTRAINT TO INCLUDE NEW SPRINT 5 EVENTS
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_event_type_check;
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS chk_outbox_event_type;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_event_type_check 
    CHECK (event_type IN (
        'DOCUMENT_UPLOADED',
        'DOCUMENT_PUBLISHED',
        'INDEX_DOCUMENT_REQUESTED',
        'OCR_COMPLETED',
        'EXTRACTION_REQUESTED',
        'WEBHOOK_REQUESTED',
        'DOCUMENT_RETRY_REQUESTED',
        'DOCUMENT_REPLACED',
        'DOCUMENT_SUMMARIZED',
        'EMAIL_ATTACHMENT_INGESTED',
        'DOCUMENT_PURGED',
        'AUDIT_LOG_RECORDED'
    ));

COMMIT;
