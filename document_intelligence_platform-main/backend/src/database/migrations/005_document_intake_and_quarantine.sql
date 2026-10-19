-- Migration: 005_document_intake_and_quarantine.sql
-- Description: Sprint 4 Document Intake, Quarantine Lifecycle, and Malware Scan Audit Tracking
-- Compatible with PostgreSQL 16 LTS

-- 1. Modify CHECK constraint on documents.status to allow PENDING_SCAN and QUARANTINED
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check 
    CHECK (status IN ('PENDING_SCAN', 'QUARANTINED', 'QUEUED', 'PROCESSING', 'STP_PROCESSED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED'));

-- 1b. Fix Tenant Deduplication Isolation: Replace global sha256 UNIQUE with composite UNIQUE(tenant_id, sha256_hash)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_sha256_hash_key;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_tenant_sha256_key;
ALTER TABLE documents ADD CONSTRAINT documents_tenant_sha256_key UNIQUE (tenant_id, sha256_hash);

-- 2. Additive columns on documents for intake & quarantine tracking
ALTER TABLE documents ADD COLUMN IF NOT EXISTS scan_status VARCHAR(50) DEFAULT 'PENDING' 
    CHECK (scan_status IN ('PENDING', 'CLEAN', 'QUARANTINED', 'SCAN_FAILED'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS quarantine_reason VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS detected_threat VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key VARCHAR(1024);

-- 3. Dedicated Document Security Scans Table for Immutable Security Audit Logs
CREATE TABLE IF NOT EXISTS document_security_scans (
    scan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    scanner_name VARCHAR(100) NOT NULL,
    scan_result VARCHAR(50) NOT NULL CHECK (scan_result IN ('CLEAN', 'INFECTED', 'SCAN_FAILED', 'SKIPPED')),
    threat_name VARCHAR(255),
    scan_duration_ms INT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_scans_document ON document_security_scans(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_scans_tenant ON document_security_scans(tenant_id, scanned_at DESC);
