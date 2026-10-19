-- DocuNexa Migration 013: Notifications, Reports, Exports & Webhooks
-- Sprint 11 Architecture: Notification delivery tracking, async exports, HMAC webhooks, and connector mappings

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    target_url VARCHAR(255),
    entity_id VARCHAR(64),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
    delivery_status VARCHAR(16) NOT NULL DEFAULT 'DELIVERED',
    delivery_attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_read ON notifications(tenant_id, user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 2. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(32) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON notification_preferences(tenant_id, user_id);

-- 3. Asynchronous Export Jobs Table
CREATE TABLE IF NOT EXISTS export_jobs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    report_type VARCHAR(64) NOT NULL,
    format VARCHAR(16) NOT NULL DEFAULT 'csv',
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    filters_snapshot JSONB NOT NULL DEFAULT '{}',
    mask_pii BOOLEAN NOT NULL DEFAULT TRUE,
    total_records INTEGER NOT NULL DEFAULT 0,
    file_path VARCHAR(255),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_hash VARCHAR(64),
    download_token VARCHAR(64),
    token_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant_status ON export_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_token ON export_jobs(download_token);

-- 4. Outbound Webhook Subscriptions Table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    target_url VARCHAR(512) NOT NULL,
    secret_hash VARCHAR(128) NOT NULL,
    secret_preview VARCHAR(16) NOT NULL,
    subscribed_events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant ON webhook_subscriptions(tenant_id, is_active);

-- 5. Outbound Webhook Deliveries Table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    subscription_id VARCHAR(64) NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_snapshot JSONB NOT NULL,
    signature_header VARCHAR(128) NOT NULL,
    timestamp_header VARCHAR(32) NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    http_status_code INTEGER,
    response_body_snippet TEXT,
    error_message TEXT,
    next_retry_at TIMESTAMPTZ,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_status ON webhook_deliveries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id);

-- 6. Connector Mappings Table
CREATE TABLE IF NOT EXISTS connector_mappings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    connector_type VARCHAR(32) NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    field_mappings JSONB NOT NULL DEFAULT '[]',
    sandbox_mode BOOLEAN NOT NULL DEFAULT TRUE,
    is_signed_off BOOLEAN NOT NULL DEFAULT FALSE,
    signed_off_by VARCHAR(64),
    signed_off_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, connector_type, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_connector_mappings_tenant ON connector_mappings(tenant_id, connector_type);
