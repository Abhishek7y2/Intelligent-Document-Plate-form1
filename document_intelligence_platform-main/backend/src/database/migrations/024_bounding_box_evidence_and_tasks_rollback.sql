-- Rollback Migration: 024_bounding_box_evidence_and_tasks_rollback.sql
-- Description: Reverts migration 024 changes cleanly and non-destructively

DROP TABLE IF EXISTS platform_task_comments;
DROP TABLE IF EXISTS platform_tasks;

ALTER TABLE document_extracted_fields 
DROP COLUMN IF EXISTS evidence;
