-- Migration 007: Classification and Field Extraction Results (Sprint 6)
-- Conforms to DocuNexa BRD FR-004, FR-005, FR-006, FR-007, FR-008

CREATE TABLE IF NOT EXISTS document_classifications (
  classification_id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL UNIQUE REFERENCES documents(document_id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL,
  predicted_type VARCHAR(64) NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL,
  classifier_name VARCHAR(128) NOT NULL,
  is_confident BOOLEAN NOT NULL DEFAULT FALSE,
  routing_decision VARCHAR(32) NOT NULL,
  matching_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_classifications_tenant ON document_classifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_classifications_doc ON document_classifications(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_classifications_type ON document_classifications(predicted_type);

CREATE TABLE IF NOT EXISTS document_extractions (
  extraction_id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL UNIQUE REFERENCES documents(document_id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL,
  document_type VARCHAR(64) NOT NULL,
  template_version VARCHAR(32) NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  routing_decision VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_extractions_tenant ON document_extractions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_extractions_doc ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_extractions_type ON document_extractions(document_type);
