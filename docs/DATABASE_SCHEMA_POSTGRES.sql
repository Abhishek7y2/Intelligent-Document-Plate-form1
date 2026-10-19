-- =============================================================================
-- DocuNexa Enterprise Platform - Relational Database Schema (PostgreSQL 16+)
-- Supports: Dynamic RBAC, Multi-tenancy, Document Workflow, Audit Trails, SLAs
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Multi-Tenant Organization Structure
CREATE TABLE tenants (
    tenant_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'ENTERPRISE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users & Dynamic RBAC Roles
CREATE TABLE users (
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

-- 3. Core Document Metadata & State Pipeline
CREATE TABLE documents (
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

CREATE INDEX idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX idx_documents_sla ON documents(sla_status, sla_deadline);
CREATE INDEX idx_documents_hash ON documents(sha256_hash);

-- 4. Field Extractions & Validation Overrides (Relational Master)
CREATE TABLE document_extracted_fields (
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

CREATE INDEX idx_fields_doc_id ON document_extracted_fields(document_id);

-- 5. Immutable Audit Logs & SHA-256 Signature Verification
CREATE TABLE audit_trail_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id),
    document_id VARCHAR(64) REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL, -- e.g., 'DOCUMENT_INGESTED', 'FIELD_CORRECTED', 'APPROVED'
    details JSONB NOT NULL,
    ip_address VARCHAR(45),
    sha256_signature VARCHAR(64) NOT NULL, -- Immutable HMAC seal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_doc_id ON audit_trail_events(document_id);
CREATE INDEX idx_audit_tenant_time ON audit_trail_events(tenant_id, created_at DESC);

-- 6. Platform Telemetry & Hourly Aggregate Metrics
CREATE TABLE telemetry_hourly_metrics (
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
