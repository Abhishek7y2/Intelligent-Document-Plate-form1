-- =============================================================================
-- Migration 009: Approvals Hierarchy, Separation of Duties (SoD) & ERP Publishing
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 8)
-- =============================================================================

-- 1. Extend documents.status constraint to support PENDING_APPROVAL and PUBLISHED
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check 
    CHECK (status IN (
        'PENDING_SCAN',
        'QUARANTINED',
        'QUEUED',
        'PROCESSING',
        'STP_PROCESSED',
        'NEEDS_REVIEW',
        'PENDING_APPROVAL',
        'APPROVED',
        'PUBLISHED',
        'REJECTED',
        'FAILED'
    ));

-- 2. Approval Requests Table (Tracks multi-level approval pipeline)
CREATE TABLE IF NOT EXISTS approval_requests (
    request_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    tier VARCHAR(16) NOT NULL DEFAULT 'TIER_1',
    monetary_amount NUMERIC(14, 2),
    currency VARCHAR(8) DEFAULT 'USD',
    required_approvals INT NOT NULL DEFAULT 1,
    approved_count INT NOT NULL DEFAULT 0,
    source_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_approval_req_doc FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_req_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_approval_req_doc UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_reqs_tenant_status 
    ON approval_requests(tenant_id, status);

-- 3. Approval Decisions Table (Immutable log of signed approver actions)
CREATE TABLE IF NOT EXISTS approval_decisions (
    decision_id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    approver_id VARCHAR(64) NOT NULL,
    approver_name VARCHAR(255) NOT NULL,
    approver_role VARCHAR(64) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    reason_code VARCHAR(128) NOT NULL,
    comments TEXT,
    signature_hash VARCHAR(64) NOT NULL,
    source_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_decision_req FOREIGN KEY (request_id)
        REFERENCES approval_requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_decision_doc FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_decision_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_req 
    ON approval_decisions(request_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_approval_decisions_doc 
    ON approval_decisions(document_id, created_at ASC);

-- 4. ERP Publications & Dispatch Log Table
CREATE TABLE IF NOT EXISTS erp_publications (
    publication_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    erp_target VARCHAR(64) NOT NULL DEFAULT 'SAP_S4HANA',
    idempotency_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    http_status_code INT,
    payload JSONB NOT NULL,
    last_error TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_erp_pub_doc FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_erp_pub_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_erp_pub_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_erp_pub_tenant_status 
    ON erp_publications(tenant_id, status);
