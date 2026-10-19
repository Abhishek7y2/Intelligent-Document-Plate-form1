-- =============================================================================
-- Rollback Migration 020: MongoDB Derived Collections Support, AI-007 Summaries,
-- and Email Intake Mailbox Tables
-- =============================================================================

BEGIN;

-- 1. Revert outbox_events check constraint to Migration 019 state
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
        'DOCUMENT_REPLACED'
    ));

-- 2. Drop processed_emails table
DROP TABLE IF EXISTS processed_emails CASCADE;

-- 3. Drop intake_mailboxes table
DROP TABLE IF EXISTS intake_mailboxes CASCADE;

-- 4. Drop summary_corrections table
DROP TABLE IF EXISTS summary_corrections CASCADE;

-- 5. Drop document_summaries table
DROP TABLE IF EXISTS document_summaries CASCADE;

COMMIT;
