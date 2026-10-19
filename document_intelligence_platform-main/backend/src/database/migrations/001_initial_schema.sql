-- Migration: 001_initial_schema.sql
-- Description: Baseline PostgreSQL 16 DDL for DocuNexa Multi-tenant Platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Schema Migration Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Multi-tenant Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'ENTERPRISE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users Table with Dynamic RBAC
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Reviewer', 'Analyst', 'Auditor')),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Documents Workflow Table
CREATE TABLE IF NOT EXISTS documents (
    document_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    file_name VARCHAR(512) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL UNIQUE,
    document_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('QUEUED', 'PROCESSING', 'STP_PROCESSED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED')),
    stage VARCHAR(50) NOT NULL,
    confidence_score NUMERIC(5, 4) CHECK (confidence_score BETWEEN 0 AND 1),
    sla_status VARCHAR(20) DEFAULT 'ON_TRACK' CHECK (sla_status IN ('ON_TRACK', 'WARNING', 'BREACHED')),
    sla_deadline TIMESTAMP WITH TIME ZONE,
    ingestion_source VARCHAR(50) NOT NULL,
    assigned_to VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    page_count INT DEFAULT 1,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256_hash);

-- 5. Extracted Fields Table
CREATE TABLE IF NOT EXISTS document_extracted_fields (
    field_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    field_key VARCHAR(128) NOT NULL,
    field_label VARCHAR(255),
    extracted_value TEXT,
    corrected_value TEXT,
    confidence_score NUMERIC(5, 4),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(64) REFERENCES users(user_id),
    verified_at TIMESTAMP WITH TIME ZONE,
    rule_flag VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, field_key)
);

-- 6. Audit Trail Events (SHA-256 Sealed)
CREATE TABLE IF NOT EXISTS audit_trail_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id),
    document_id VARCHAR(64) REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL,
    ip_address VARCHAR(45),
    sha256_signature VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_trail_events(tenant_id, created_at DESC);

-- 7. Telemetry Hourly Aggregate Metrics Table
CREATE TABLE IF NOT EXISTS telemetry_hourly_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id),
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    total_processed INT DEFAULT 0,
    stp_count INT DEFAULT 0,
    review_count INT DEFAULT 0,
    sla_breaches INT DEFAULT 0,
    avg_processing_ms INT DEFAULT 0,
    avg_confidence NUMERIC(5, 4) DEFAULT 0,
    UNIQUE(tenant_id, metric_timestamp)
);
