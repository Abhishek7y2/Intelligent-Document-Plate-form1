-- Migration: 006_ocr_geometry_and_pages.sql
-- Description: Sprint 5 OCR Layout, Document Geometry, and Page Layout Persistence
-- Target Engine: PostgreSQL 16 LTS with JSONB

-- 1. Document OCR Execution Results Table
CREATE TABLE IF NOT EXISTS document_ocr_results (
    ocr_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    engine_name VARCHAR(64) NOT NULL,
    engine_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    total_pages INT NOT NULL DEFAULT 1,
    overall_confidence NUMERIC(5, 4) CHECK (overall_confidence BETWEEN 0 AND 1),
    full_text TEXT,
    layout_json JSONB NOT NULL,
    duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT doc_ocr_document_unique UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_ocr_tenant_doc ON document_ocr_results(tenant_id, document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_status ON document_ocr_results(tenant_id, status);

-- 2. Document Pages Spatial Geometry Table
CREATE TABLE IF NOT EXISTS document_pages (
    page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(64) NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    width NUMERIC(10, 2) NOT NULL,
    height NUMERIC(10, 2) NOT NULL,
    dpi INT DEFAULT 300,
    page_text TEXT,
    confidence NUMERIC(5, 4) CHECK (confidence BETWEEN 0 AND 1),
    tokens_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doc_pages_doc_num_unique UNIQUE (document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_pages_lookup ON document_pages(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_doc_pages_tenant ON document_pages(tenant_id, document_id);
