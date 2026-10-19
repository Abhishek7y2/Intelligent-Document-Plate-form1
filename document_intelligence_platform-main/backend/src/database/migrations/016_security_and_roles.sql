-- Migration: 016_security_and_roles.sql
-- Description: Tenant-scoped document SHA-256 uniqueness and canonical RBAC roles (Sprint 1)

-- 1. Replace table-wide SHA-256 uniqueness with composite (tenant_id, sha256_hash)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_sha256_hash_key;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_tenant_sha256_key;
ALTER TABLE documents ADD CONSTRAINT documents_tenant_sha256_key UNIQUE (tenant_id, sha256_hash);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_sha256 ON documents(tenant_id, sha256_hash);

-- 2. Expand role CHECK constraints on users table to support canonical BRD roles while preserving legacy aliases
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
    role IN (
        'Admin', 'Reviewer', 'Approver', 'FinanceHead', 'Analyst', 'Auditor',
        'platform_operator', 'org_admin', 'contributor', 'reviewer', 'approver', 'auditor'
    )
);

-- 3. Expand role CHECK constraints on tenant_memberships table
ALTER TABLE tenant_memberships DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
ALTER TABLE tenant_memberships ADD CONSTRAINT tenant_memberships_role_check CHECK (
    role IN (
        'Admin', 'Reviewer', 'Approver', 'FinanceHead', 'Analyst', 'Auditor',
        'platform_operator', 'org_admin', 'contributor', 'reviewer', 'approver', 'auditor'
    )
);
