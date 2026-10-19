-- Rollback Migration: 025_tasks_compatibility_views_rollback.sql
-- Description: Drops compatibility views for tasks and task_comments

DROP VIEW IF EXISTS tasks CASCADE;
DROP VIEW IF EXISTS task_comments CASCADE;
