-- Rollback Migration: 022_hardening_idempotency_notifications_correlation_rollback.sql

DROP INDEX IF EXISTS idx_webhook_deliveries_sub_event;

DROP INDEX IF EXISTS idx_processing_attempts_correlation;
ALTER TABLE document_processing_attempts DROP COLUMN IF EXISTS correlation_id;

DROP INDEX IF EXISTS idx_outbox_correlation_id;
ALTER TABLE outbox_events DROP COLUMN IF EXISTS correlation_id;

DROP INDEX IF EXISTS idx_audit_correlation_id;
ALTER TABLE audit_trail_events DROP COLUMN IF EXISTS correlation_id;

DROP INDEX IF EXISTS idx_documents_tenant_expires;
ALTER TABLE documents DROP COLUMN IF EXISTS expires_at;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS export_masking_rules;
DROP TABLE IF EXISTS idempotency_keys;
