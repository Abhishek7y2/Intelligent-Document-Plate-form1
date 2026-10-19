-- Migration: 024_bounding_box_evidence_and_tasks.sql
-- Description: Adds evidence JSONB to document_extracted_fields and creates platform_tasks and task comments tables (Sprint 7 Part 0 & Part F)

-- 1. Add evidence JSONB column to document_extracted_fields
ALTER TABLE document_extracted_fields 
ADD COLUMN IF NOT EXISTS evidence JSONB;

-- 2. Platform Tasks table for enterprise task management (Part F.1 / FR-011)
CREATE TABLE IF NOT EXISTS platform_tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    document_id VARCHAR(64) REFERENCES documents(document_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    assignee_name VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    due_date TIMESTAMPTZ,
    created_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_tenant_status ON platform_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_platform_tasks_assignee ON platform_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_platform_tasks_due_date ON platform_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_platform_tasks_document ON platform_tasks(document_id);

-- 3. Platform Task Comments thread table (Part F.1 / FR-011)
CREATE TABLE IF NOT EXISTS platform_task_comments (
    comment_id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL REFERENCES platform_tasks(task_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_task_comments_task ON platform_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_platform_task_comments_tenant ON platform_task_comments(tenant_id);
