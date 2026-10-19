-- Migration: 025_tasks_compatibility_views.sql
-- Description: Reconciles tasks and task_comments non-destructively by creating compatibility views if table names are referenced directly.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tasks'
    ) THEN
        CREATE VIEW tasks AS SELECT * FROM platform_tasks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'task_comments'
    ) THEN
        CREATE VIEW task_comments AS SELECT * FROM platform_task_comments;
    END IF;
END $$;
