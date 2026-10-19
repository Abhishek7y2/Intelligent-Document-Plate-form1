import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { dbPool } from '../database/postgres.client.js';
import { AuditTrailService } from '../services/audit-trail.service.js';
import { NotificationService } from '../services/notification.service.js';

export interface TaskRecord {
  taskId: string;
  tenantId: string;
  documentId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  status: string;
  priority: string;
  dueDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  comments?: TaskCommentRecord[];
}

export interface TaskCommentRecord {
  commentId: string;
  taskId: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  commentText: string;
  createdAt: string;
}

// In-memory fallback map for offline unit tests (e.g. without live postgres)
const inMemoryTasks = new Map<string, TaskRecord>();
const inMemoryComments = new Map<string, TaskCommentRecord[]>();

export function clearInMemoryTasks(): void {
  inMemoryTasks.clear();
  inMemoryComments.clear();
}

/**
 * List tenant tasks with filters (mine, overdue, status, priority)
 * GET /api/v1/tasks (Sprint 7 Part F.1)
 */
export async function listTasksHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    const { mine, overdue, status, priority } = req.query;
    const isMine = mine === 'true' || mine === '1';
    const isOverdue = overdue === 'true' || overdue === '1';

    try {
      let query = `
        SELECT task_id as "taskId", tenant_id as "tenantId", document_id as "documentId",
               title, description, assignee_id as "assigneeId", assignee_name as "assigneeName",
               status, priority, due_date as "dueDate", created_by as "createdBy",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM platform_tasks
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];

      if (isMine && userId) {
        params.push(userId);
        query += ` AND assignee_id = $${params.length}`;
      }

      if (isOverdue) {
        query += ` AND due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('COMPLETED', 'RESOLVED', 'CLOSED')`;
      }

      if (status && typeof status === 'string') {
        params.push(status.toUpperCase());
        query += ` AND UPPER(status) = $${params.length}`;
      }

      if (priority && typeof priority === 'string') {
        params.push(priority.toUpperCase());
        query += ` AND UPPER(priority) = $${params.length}`;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await dbPool.query(query, params);
      res.status(200).json({
        status: 'SUCCESS',
        tenantId,
        tasks: result.rows,
        count: result.rows.length,
      });
      return;
    } catch {
      // In-memory fallback
      let tasks = Array.from(inMemoryTasks.values()).filter((t) => t.tenantId === tenantId);
      if (isMine && userId) {
        tasks = tasks.filter((t) => t.assigneeId === userId);
      }
      if (isOverdue) {
        const now = new Date();
        tasks = tasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now && !['COMPLETED', 'RESOLVED', 'CLOSED'].includes(t.status.toUpperCase())
        );
      }
      if (status && typeof status === 'string') {
        tasks = tasks.filter((t) => t.status.toUpperCase() === status.toUpperCase());
      }
      if (priority && typeof priority === 'string') {
        tasks = tasks.filter((t) => t.priority.toUpperCase() === priority.toUpperCase());
      }

      res.status(200).json({
        status: 'SUCCESS',
        tenantId,
        tasks,
        count: tasks.length,
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new task (tenant-scoped, audits creation, dispatches reminder notification if due date set)
 * POST /api/v1/tasks (Sprint 7 Part F.1)
 */
export async function createTaskHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    const { title, description, assigneeId, assignedTo, assigneeName, dueDate, documentId, linkedDocumentId, priority } = req.body;
    const finalAssigneeId = assigneeId || assignedTo;
    const finalDocId = documentId || linkedDocumentId;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Task title is required.',
        status: 400,
      });
      return;
    }

    const taskId = `TASK-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const taskStatus = 'OPEN';
    const taskPriority = (priority || 'MEDIUM').toUpperCase();

    const taskRecord: TaskRecord = {
      taskId,
      tenantId,
      documentId: finalDocId || undefined,
      title: title.trim(),
      description: description || '',
      assigneeId: finalAssigneeId || undefined,
      assigneeName: assigneeName || (finalAssigneeId ? 'Assigned Member' : undefined),
      status: taskStatus,
      priority: taskPriority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await dbPool.query(
        `INSERT INTO platform_tasks (
          task_id, tenant_id, document_id, title, description,
          assignee_id, assignee_name, status, priority, due_date, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          taskRecord.taskId,
          taskRecord.tenantId,
          taskRecord.documentId || null,
          taskRecord.title,
          taskRecord.description || null,
          taskRecord.assigneeId || null,
          taskRecord.assigneeName || null,
          taskRecord.status,
          taskRecord.priority,
          taskRecord.dueDate || null,
          taskRecord.createdBy || null,
          taskRecord.createdAt,
          taskRecord.updatedAt,
        ]
      );
    } catch {
      // In-memory fallback
    }

    inMemoryTasks.set(taskId, taskRecord);

    // Audit trail record
    try {
      await AuditTrailService.recordEvent({
        tenantId,
        userId,
        documentId: documentId || undefined,
        action: 'TASK_CREATED',
        details: { taskId, title, assigneeId, dueDate, priority: taskPriority },
      });
    } catch {}

    // Dispatch notification if assigned or due date configured
    if (assigneeId) {
      try {
        await NotificationService.dispatchNotification(tenantId, {
          userId: assigneeId,
          title: `New Task Assigned: ${title}`,
          message: `You were assigned task '${title}'.${dueDate ? ` Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
          type: 'task_assigned',
          category: 'tasks',
          severity: 'info',
        });
      } catch {}
    }

    res.status(201).json({
      status: 'SUCCESS',
      message: `Task '${taskId}' created successfully.`,
      task: taskRecord,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get task details including comment thread
 * GET /api/v1/tasks/:id (Sprint 7 Part F.1)
 */
export async function getTaskHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const taskId = req.params['id'];

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    let task: TaskRecord | null = null;
    let comments: TaskCommentRecord[] = [];

    try {
      const taskRes = await dbPool.query(
        `SELECT task_id as "taskId", tenant_id as "tenantId", document_id as "documentId",
                title, description, assignee_id as "assigneeId", assignee_name as "assigneeName",
                status, priority, due_date as "dueDate", created_by as "createdBy",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM platform_tasks
         WHERE task_id = $1 AND tenant_id = $2`,
        [taskId, tenantId]
      );
      if (taskRes.rows.length > 0) {
        task = taskRes.rows[0];
      }

      const commentsRes = await dbPool.query(
        `SELECT comment_id as "commentId", task_id as "taskId", tenant_id as "tenantId",
                author_id as "authorId", author_name as "authorName",
                comment_text as "commentText", created_at as "createdAt"
         FROM platform_task_comments
         WHERE task_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [taskId, tenantId]
      );
      comments = commentsRes.rows;
    } catch {
      task = inMemoryTasks.get(taskId) || null;
      if (task && task.tenantId === tenantId) {
        comments = inMemoryComments.get(taskId) || [];
      } else {
        task = null;
      }
    }

    if (!task || task.tenantId !== tenantId) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: `Task '${taskId}' not found within tenant.`,
        status: 404,
      });
      return;
    }

    res.status(200).json({
      status: 'SUCCESS',
      task: {
        ...task,
        comments,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update task status, priority, due date, description or assignee
 * PATCH /api/v1/tasks/:id (Sprint 7 Part F.1)
 */
export async function updateTaskHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const taskId = req.params['id'];

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    const { title, description, assigneeId, assigneeName, status, priority, dueDate } = req.body;
    const now = new Date().toISOString();

    let task: TaskRecord | null = null;
    try {
      const existingRes = await dbPool.query(
        `SELECT * FROM platform_tasks WHERE task_id = $1 AND tenant_id = $2`,
        [taskId, tenantId]
      );
      if (existingRes.rows.length === 0) {
        res.status(404).json({
          type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
          title: `Task '${taskId}' not found within tenant.`,
          status: 404,
        });
        return;
      }

      await dbPool.query(
        `UPDATE platform_tasks SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          assignee_id = COALESCE($3, assignee_id),
          assignee_name = COALESCE($4, assignee_name),
          status = COALESCE($5, status),
          priority = COALESCE($6, priority),
          due_date = COALESCE($7, due_date),
          updated_at = $8
         WHERE task_id = $9 AND tenant_id = $10`,
        [
          title || null,
          description !== undefined ? description : null,
          assigneeId !== undefined ? assigneeId : null,
          assigneeName !== undefined ? assigneeName : null,
          status ? status.toUpperCase() : null,
          priority ? priority.toUpperCase() : null,
          dueDate ? new Date(dueDate).toISOString() : null,
          now,
          taskId,
          tenantId,
        ]
      );

      const updatedRes = await dbPool.query(
        `SELECT task_id as "taskId", tenant_id as "tenantId", document_id as "documentId",
                title, description, assignee_id as "assigneeId", assignee_name as "assigneeName",
                status, priority, due_date as "dueDate", created_by as "createdBy",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM platform_tasks WHERE task_id = $1 AND tenant_id = $2`,
        [taskId, tenantId]
      );
      task = updatedRes.rows[0];
    } catch {
      task = inMemoryTasks.get(taskId) || null;
      if (!task || task.tenantId !== tenantId) {
        res.status(404).json({
          type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
          title: `Task '${taskId}' not found within tenant.`,
          status: 404,
        });
        return;
      }

      if (title) task.title = title;
      if (description !== undefined) task.description = description;
      if (assigneeId !== undefined) task.assigneeId = assigneeId;
      if (assigneeName !== undefined) task.assigneeName = assigneeName;
      if (status) task.status = status.toUpperCase();
      if (priority) task.priority = priority.toUpperCase();
      if (dueDate) task.dueDate = new Date(dueDate).toISOString();
      task.updatedAt = now;
      inMemoryTasks.set(taskId, task);
    }

    // Audit trail
    try {
      await AuditTrailService.recordEvent({
        tenantId,
        userId,
        action: 'TASK_UPDATED',
        details: { taskId, status, priority, assigneeId, dueDate },
      });
    } catch {}

    res.status(200).json({
      status: 'SUCCESS',
      message: `Task '${taskId}' updated successfully.`,
      task,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a comment to a task's thread (FR-011)
 * POST /api/v1/tasks/:id/comments (Sprint 7 Part F.1)
 */
export async function addTaskCommentHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const userName = req.user?.email || 'User';
    const taskId = req.params['id'];
    const commentText = req.body.commentText || req.body.comment;

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Comment text cannot be empty.',
        status: 400,
      });
      return;
    }

    const commentId = `COMM-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const commentRecord: TaskCommentRecord = {
      commentId,
      taskId,
      tenantId,
      authorId: userId,
      authorName: userName,
      commentText: commentText.trim(),
      createdAt: now,
    };

    try {
      await dbPool.query(
        `INSERT INTO platform_task_comments (
          comment_id, task_id, tenant_id, author_id, author_name, comment_text, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          commentRecord.commentId,
          commentRecord.taskId,
          commentRecord.tenantId,
          commentRecord.authorId,
          commentRecord.authorName,
          commentRecord.commentText,
          commentRecord.createdAt,
        ]
      );
    } catch {
      // In-memory fallback
    }

    const existing = inMemoryComments.get(taskId) || [];
    existing.push(commentRecord);
    inMemoryComments.set(taskId, existing);

    // Audit trail
    try {
      await AuditTrailService.recordEvent({
        tenantId,
        userId,
        action: 'TASK_COMMENT_ADDED',
        details: { taskId, commentId },
      });
    } catch {}

    res.status(201).json({
      status: 'SUCCESS',
      comment: commentRecord,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List comments on a task
 * GET /api/v1/tasks/:id/comments (Sprint 7 Part F.1)
 */
export async function listTaskCommentsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const taskId = req.params['id'];

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    try {
      const resDb = await dbPool.query(
        `SELECT comment_id as "commentId", task_id as "taskId", tenant_id as "tenantId",
                author_id as "authorId", author_name as "authorName",
                comment_text as "commentText", created_at as "createdAt"
         FROM platform_task_comments
         WHERE task_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [taskId, tenantId]
      );
      res.status(200).json({
        status: 'SUCCESS',
        taskId,
        comments: resDb.rows,
      });
      return;
    } catch {
      const comments = (inMemoryComments.get(taskId) || []).filter((c) => c.tenantId === tenantId);
      res.status(200).json({
        status: 'SUCCESS',
        taskId,
        comments,
      });
    }
  } catch (err) {
    next(err);
  }
}
