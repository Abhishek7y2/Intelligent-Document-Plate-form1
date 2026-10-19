-- Migration: 022_hardening_idempotency_notifications_correlation.sql
-- Description: Sprint 6 API hardening - Idempotency keys, Export masking rules, Notifications, Document expiry, and Correlation ID propagation

-- 1. Idempotency Keys (FR-023)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'completed')),
    response_status INT,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant_id, user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- 2. Export Masking Rules (FR-018)
CREATE TABLE IF NOT EXISTS export_masking_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_type VARCHAR(50),
    field_key VARCHAR(100) NOT NULL,
    masked_for_roles TEXT[] NOT NULL DEFAULT '{}',
    mask_style VARCHAR(20) NOT NULL CHECK (mask_style IN ('full', 'partial')) DEFAULT 'full',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_export_masking_rules_tenant ON export_masking_rules(tenant_id, document_type);

-- 3. In-App Notifications (FR-020)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_read ON notifications(tenant_id, user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created ON notifications(tenant_id, created_at DESC);

-- 4. Document Expiry Date Column (FR-020 / D.3)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_expires ON documents(tenant_id, expires_at) WHERE expires_at IS NOT NULL;

-- 5. Correlation ID Columns (NFR-07 / E.2)
ALTER TABLE audit_trail_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON audit_trail_events(correlation_id) WHERE correlation_id IS NOT NULL;

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_outbox_correlation_id ON outbox_events(correlation_id) WHERE correlation_id IS NOT NULL;

ALTER TABLE document_processing_attempts ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_processing_attempts_correlation ON document_processing_attempts(correlation_id) WHERE correlation_id IS NOT NULL;

-- 6. Webhook Unique Constraint (B.4)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_sub_event ON webhook_deliveries(subscription_id, event_id);
