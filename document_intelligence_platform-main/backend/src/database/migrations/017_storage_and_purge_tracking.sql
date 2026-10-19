-- Migration: 017_storage_and_purge_tracking.sql
-- Description: Sprint 2 Storage metadata, scan state, and purge retry tracking

-- 1. Storage metadata on documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32) DEFAULT 's3';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(128);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_etag VARCHAR(128);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documents_storage_provider ON documents(tenant_id, storage_provider);

-- 2. Purge retry tracking on deletion_cases table
ALTER TABLE deletion_cases ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deletion_cases ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deletion_cases_retry ON deletion_cases(tenant_id, status, retry_count);
