-- Migration: 002_identity_and_sessions.sql
-- Description: Additive migration for Multi-Tenant Memberships, Auth Sessions & Token Rotation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenant Memberships Table (Multi-tenant association & roles)
CREATE TABLE IF NOT EXISTS tenant_memberships (
    membership_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Reviewer', 'Analyst', 'Auditor')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_tenant ON tenant_memberships(user_id, tenant_id);

-- 2. Auth Sessions Table (Refresh token hashing, token family reuse detection & revocation)
CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) NOT NULL,
    family_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    is_revoked BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_tenant ON auth_sessions(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON auth_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON auth_sessions(family_id);
