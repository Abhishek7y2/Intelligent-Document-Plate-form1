-- =============================================================================
-- Migration 008: Review Workbench, Field Corrections, and HITL Audit
-- DocuNexa Enterprise Document Intelligence Platform (Sprint 7)
-- =============================================================================

-- 1. Review Tasks Table
CREATE TABLE IF NOT EXISTS review_tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    assignee_id VARCHAR(64),
    assignee_name VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'Pending Review',
    priority VARCHAR(16) NOT NULL DEFAULT 'High',
    sla_hours_left NUMERIC(5, 2) DEFAULT 24.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_review_task_document FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_task_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_review_task_document UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_review_tasks_tenant_status 
    ON review_tasks(tenant_id, status);

-- 2. Field Corrections Audit Table
CREATE TABLE IF NOT EXISTS field_corrections (
    correction_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    field_key VARCHAR(128) NOT NULL,
    original_value JSONB,
    corrected_value JSONB,
    reviewer_id VARCHAR(64) NOT NULL,
    reviewer_name VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_field_correction_document FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_field_correction_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_field_corrections_doc 
    ON field_corrections(document_id, field_key);

-- 3. Review Workflow Audit Events Table
CREATE TABLE IF NOT EXISTS review_audit_events (
    event_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_review_event_document FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_event_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_events_doc 
    ON review_audit_events(document_id, created_at DESC);
