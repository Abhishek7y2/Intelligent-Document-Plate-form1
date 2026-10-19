-- =============================================================================
-- Migration 021: Fix Outbox Events Event Type Check Constraint Regression
-- Target Engine: PostgreSQL 16 LTS
-- Description: Recreates outbox_events_event_type_check with the complete union of
--              all allowed event types across Migrations 001-020 and backend services.
-- =============================================================================

BEGIN;

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
