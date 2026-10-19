-- Migration: 014_retention_legal_hold_and_secure_purge.sql
-- Description: Sprint 12 Retention Policies, Legal Hold Freeze, Multi-Store Purge Orchestration, and Audit Ledger
-- Compatible with PostgreSQL 16 LTS + pgvector

-- 1. Modify CHECK constraint on documents.status to allow PURGED and DELETION_PENDING
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check 
    CHECK (status IN (
      'PENDING_SCAN', 'QUARANTINED', 'QUEUED', 'PROCESSING', 
      'STP_PROCESSED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 
      'FAILED', 'DELETION_PENDING', 'PURGED'
    ));

-- 2. Versioned Retention Policies Table
CREATE TABLE IF NOT EXISTS retention_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_type VARCHAR(64) NOT NULL,
    retention_period_years INTEGER NOT NULL DEFAULT 7,
    trigger_event VARCHAR(64) NOT NULL DEFAULT 'creation_date',
    action_after_expiry VARCHAR(32) NOT NULL DEFAULT 'purge' CHECK (action_after_expiry IN ('purge', 'archive', 'review')),
    version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'SUPERSEDED', 'ARCHIVED')),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant ON retention_policies(tenant_id, status, document_type);

-- 3. Legal Holds Table
CREATE TABLE IF NOT EXISTS legal_holds (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    matter_name VARCHAR(255) NOT NULL,
    matter_number VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    scope_document_ids TEXT[] NOT NULL DEFAULT '{}',
    scope_document_type VARCHAR(64),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED')),
    placed_by VARCHAR(64) NOT NULL,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_by VARCHAR(64),
    released_at TIMESTAMPTZ,
    release_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_tenant_status ON legal_holds(tenant_id, status);

-- 4. Deletion Cases Table
CREATE TABLE IF NOT EXISTS deletion_cases (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    document_title VARCHAR(255) NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    source_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    retention_policy_id VARCHAR(64),
    legal_basis VARCHAR(64) NOT NULL DEFAULT 'RETENTION_EXPIRY',
    status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
      'REQUESTED', 'APPROVED', 'HOLD_CHECK', 'ACCESS_REVOKED', 
      'DERIVED_DATA_REMOVED', 'FILES_DELETED', 'COMPLETED', 
      'EXCEPTION', 'PAUSED_BY_LEGAL_HOLD'
    )),
    requested_by VARCHAR(64) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    hold_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    hold_checked_at TIMESTAMPTZ,
    active_hold_id VARCHAR(64),
    completed_at TIMESTAMPTZ,
    evidence JSONB NOT NULL DEFAULT '{}',
    purge_signature_hash VARCHAR(64),
    correlation_id VARCHAR(64),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_cases_tenant ON deletion_cases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_deletion_cases_doc ON deletion_cases(tenant_id, document_id);

-- 5. Immutable Purge Audit Ledger Table
CREATE TABLE IF NOT EXISTS purge_audit_ledger (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    case_id VARCHAR(64) NOT NULL REFERENCES deletion_cases(id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL,
    store_target VARCHAR(64) NOT NULL,
    operation_type VARCHAR(32) NOT NULL DEFAULT 'PURGE',
    status VARCHAR(16) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'BLOCKED_BY_HOLD', 'SKIPPED_BY_POLICY')),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}',
    sha256_seal VARCHAR(64) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purge_ledger_tenant ON purge_audit_ledger(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_purge_ledger_case ON purge_audit_ledger(case_id);
