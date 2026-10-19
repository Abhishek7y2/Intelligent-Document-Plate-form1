-- Migration: 004_document_types_templates_policies.sql
-- Description: Configurable Document Type Catalog, Extraction Templates, Field Definitions & Policy Configuration Engine

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Document Types Catalog Table
CREATE TABLE IF NOT EXISTS document_types (
    type_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'INACTIVE')),
    active_version VARCHAR(30) DEFAULT 'v1.0',
    workflow VARCHAR(100) DEFAULT 'Validation -> Review -> Approval',
    created_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_types_tenant_code ON document_types (COALESCE(tenant_id, 'GLOBAL'), code);
CREATE INDEX IF NOT EXISTS idx_doc_types_status ON document_types (status);

-- 2. Extraction Templates & Field Definitions Table
CREATE TABLE IF NOT EXISTS extraction_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type_id VARCHAR(64) NOT NULL REFERENCES document_types(type_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    version VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_at TIMESTAMP WITH TIME ZONE,
    published_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_type_version ON extraction_templates (document_type_id, COALESCE(tenant_id, 'GLOBAL'), version);
CREATE INDEX IF NOT EXISTS idx_templates_type_status ON extraction_templates (document_type_id, status);
-- Guarantee at the database level that only one template version can be PUBLISHED per document type + tenant scope
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_template_per_doctype_tenant ON extraction_templates (document_type_id, COALESCE(tenant_id, 'GLOBAL')) WHERE status = 'PUBLISHED';

-- 3. Policy Configuration Table
CREATE TABLE IF NOT EXISTS processing_policies (
    policy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type_id VARCHAR(64) NOT NULL REFERENCES document_types(type_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    policy_type VARCHAR(50) NOT NULL DEFAULT 'VALIDATION' CHECK (policy_type IN ('VALIDATION', 'APPROVAL_ROUTING', 'CONFIDENCE_THRESHOLD', 'SLA_GATE')),
    version VARCHAR(30) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_type_version ON processing_policies (document_type_id, COALESCE(tenant_id, 'GLOBAL'), version);
CREATE INDEX IF NOT EXISTS idx_policies_type_status ON processing_policies (document_type_id, status);
-- Guarantee at the database level that only one policy version can be ACTIVE per document type + policy type + tenant scope
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_policy_per_doctype_tenant_type ON processing_policies (document_type_id, policy_type, COALESCE(tenant_id, 'GLOBAL')) WHERE status = 'ACTIVE';

-- 4. Seed MVP Global Document Types
INSERT INTO document_types (type_id, tenant_id, code, name, description, status, active_version, workflow)
VALUES
    ('purchase-invoice', NULL, 'PUR-INVOICE', 'Purchase Invoice', 'Supplier tax invoices, line items breakdown, IGST tax calculations, and PO matching.', 'ACTIVE', 'v2.1', 'Validation -> Review -> Approval'),
    ('supplier-contract', NULL, 'SUP-CONTRACT', 'Supplier Contract', 'Master equipment and service agreements, liability caps, effective dates, and renewal terms.', 'ACTIVE', 'v1.4', 'Legal Review -> Executive Approval'),
    ('internal-policy', NULL, 'INT-POLICY', 'Internal Policy', 'Corporate governance policies, document control IDs, versioning, and compliance officer sign-offs.', 'ACTIVE', 'v4.2', 'Policy Owner Approval')
ON CONFLICT DO NOTHING;
