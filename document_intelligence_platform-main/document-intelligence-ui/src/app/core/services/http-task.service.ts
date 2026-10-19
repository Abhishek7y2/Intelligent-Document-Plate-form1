import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  documentId?: string;
  documentName?: string;
  assignedTo?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  comment: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class HttpTaskService {
  private readonly api = inject(ApiClient);

  getTasks(filter?: { mine?: boolean; overdue?: boolean; status?: string }): Observable<TaskRecord[]> {
    return this.api.get<any>('/tasks', filter).pipe(
      map((res) => {
        let list: any[] = [];
        if (Array.isArray(res)) list = res;
        else if (Array.isArray(res?.data)) list = res.data;
        else if (Array.isArray(res?.tasks)) list = res.tasks;
        return list.map((t) => ({
          id: t.taskId || t.id,
          title: t.title,
          description: t.description || '',
          documentId: t.documentId || t.linkedDocumentId,
          documentName: t.documentName || (t.documentId ? `Doc #${t.documentId}` : undefined),
          assignedTo: t.assigneeName || t.assigneeId || t.assignedTo || 'Unassigned',
          status: (t.status || 'PENDING').toUpperCase() as any,
          priority: (t.priority || 'MEDIUM').toUpperCase() as any,
          dueDate: t.dueDate,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));
      }),
      catchError((err) => {
        console.warn('[HttpTaskService] Failed to fetch tasks:', err);
        return of([]);
      })
    );
  }

  getTaskById(id: string): Observable<TaskRecord | null> {
    return this.api.get<any>(`/tasks/${id}`).pipe(
      map((res) => {
        const t = res?.task || res?.data || res;
        if (!t) return null;
        return {
          id: t.taskId || t.id,
          title: t.title,
          description: t.description || '',
          documentId: t.documentId || t.linkedDocumentId,
          documentName: t.documentName || (t.documentId ? `Doc #${t.documentId}` : undefined),
          assignedTo: t.assigneeName || t.assigneeId || t.assignedTo || 'Unassigned',
          status: (t.status || 'PENDING').toUpperCase() as any,
          priority: (t.priority || 'MEDIUM').toUpperCase() as any,
          dueDate: t.dueDate,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
      }),
      catchError((err) => {
        console.warn(`[HttpTaskService] Failed to fetch task ${id}:`, err);
        return of(null);
      })
    );
  }

  createTask(payload: {
    title: string;
    description?: string;
    assignedTo?: string;
    dueDate?: string;
    linkedDocumentId?: string;
    priority?: string;
  }): Observable<TaskRecord> {
    return this.api.post<any>('/tasks', {
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assignedTo,
      dueDate: payload.dueDate,
      documentId: payload.linkedDocumentId,
      priority: payload.priority,
    }).pipe(
      map((res) => {
        const t = res?.task || res?.data || res;
        return {
          id: t.taskId || t.id,
          title: t.title,
          description: t.description,
          documentId: t.documentId,
          assignedTo: t.assigneeName || t.assigneeId || t.assignedTo,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          createdAt: t.createdAt,
        };
      })
    );
  }

  updateTask(
    id: string,
    payload: {
      status?: string;
      title?: string;
      description?: string;
      assignedTo?: string;
      dueDate?: string;
      priority?: string;
    }
  ): Observable<TaskRecord> {
    return this.api.patch<any>(`/tasks/${id}`, {
      status: payload.status,
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assignedTo,
      dueDate: payload.dueDate,
      priority: payload.priority,
    }).pipe(
      map((res) => res?.task || res?.data || res)
    );
  }

  getTaskComments(taskId: string): Observable<TaskComment[]> {
    return this.api.get<any>(`/tasks/${taskId}/comments`).pipe(
      map((res) => {
        let list: any[] = [];
        if (Array.isArray(res)) list = res;
        else if (Array.isArray(res?.data)) list = res.data;
        else if (Array.isArray(res?.comments)) list = res.comments;
        return list.map((c) => ({
          id: c.commentId || c.id,
          taskId: c.taskId,
          authorId: c.authorId,
          authorName: c.authorName || 'User',
          comment: c.commentText || c.comment,
          createdAt: c.createdAt,
        }));
      }),
      catchError((err) => {
        console.warn(`[HttpTaskService] Failed to fetch comments for task ${taskId}:`, err);
        return of([]);
      })
    );
  }

  addTaskComment(taskId: string, comment: string): Observable<TaskComment> {
    return this.api.post<any>(`/tasks/${taskId}/comments`, { commentText: comment }).pipe(
      map((res) => {
        const c = res?.comment || res?.data || res;
        return {
          id: c.commentId || c.id,
          taskId: c.taskId,
          authorId: c.authorId,
          authorName: c.authorName || 'User',
          comment: c.commentText || c.comment,
          createdAt: c.createdAt,
        };
      })
    );
  }
}
