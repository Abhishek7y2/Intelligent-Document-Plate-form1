import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { HttpTaskService, TaskRecord, TaskComment } from '../../core/services/http-task.service';
import { AuthService } from '../../core/services/auth';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  documentId?: string;
  documentName?: string;
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  assignedBy: string;
  dueDate: string;
  createdAt: string;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingState, EmptyState, ErrorState],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
})
export class Tasks implements OnInit {
  private readonly taskService = inject(HttpTaskService);
  private readonly authService = inject(AuthService);

  searchTerm = '';
  selectedStatus = 'All Status';
  selectedPriority = 'All Priority';
  filterScope: 'all' | 'mine' | 'overdue' = 'all';

  isLoading = signal(true);
  hasError = signal(false);

  selectedTask: TaskItem | null = null;
  showTaskPanel = false;
  taskComments = signal<TaskComment[]>([]);
  newCommentText = '';
  isAddingComment = signal(false);

  // Create / Edit modal state
  showCreateModal = false;
  isEditing = false;
  editingTaskId: string | null = null;
  taskForm = {
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    linkedDocumentId: '',
    priority: 'Medium',
    status: 'Pending',
  };
  formError = '';
  isSavingTask = signal(false);

  tasks: TaskItem[] = [];

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    const filter: { mine?: boolean; overdue?: boolean } = {};
    if (this.filterScope === 'mine') filter.mine = true;
    if (this.filterScope === 'overdue') filter.overdue = true;

    this.taskService.getTasks(filter).subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          this.tasks = list.map((t) => this.mapRecordToItem(t));
        } else {
          // Fallback initial demo tasks if empty
          this.tasks = [
            {
              id: 'TSK-101',
              title: 'Review Supplier Master Agreement',
              description: 'Verify extracted metadata, tax tables and resolve field anomalies.',
              documentId: 'DOC-10248',
              documentName: 'Supplier Master Agreement.pdf',
              type: 'Review',
              priority: 'High',
              status: 'Pending',
              assignedBy: 'Priya Mehta',
              dueDate: new Date(Date.now() + 86400000).toLocaleDateString(),
              createdAt: 'Today',
            },
            {
              id: 'TSK-102',
              title: 'Reconcile Invoice Totals',
              description: 'Arithmetic cross-field validation requires manager review.',
              documentId: 'DOC-10247',
              documentName: 'INV-78421.pdf',
              type: 'Approval',
              priority: 'High',
              status: 'In Progress',
              assignedBy: 'System',
              dueDate: new Date(Date.now() + 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: 'Yesterday',
            },
          ];
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private mapRecordToItem(t: TaskRecord): TaskItem {
    let uiStatus: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' = 'Pending';
    const s = (t.status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'RESOLVED' || s === 'CLOSED') uiStatus = 'Completed';
    else if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') uiStatus = 'In Progress';
    else if (t.dueDate && new Date(t.dueDate) < new Date() && s !== 'COMPLETED') uiStatus = 'Overdue';
    else uiStatus = 'Pending';

    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    const p = (t.priority || '').toUpperCase();
    if (p === 'HIGH') priority = 'High';
    else if (p === 'LOW') priority = 'Low';

    return {
      id: t.id,
      title: t.title,
      description: t.description || 'No description provided.',
      documentId: t.documentId,
      documentName: t.documentName || (t.documentId ? `Document ${t.documentId}` : undefined),
      type: 'Review',
      priority,
      status: uiStatus,
      assignedBy: t.assignedTo || 'System',
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Recent',
    };
  }

  setFilterScope(scope: 'all' | 'mine' | 'overdue'): void {
    this.filterScope = scope;
    this.loadTasks();
  }

  retryLoad(): void {
    this.loadTasks();
  }

  get filteredTasks(): TaskItem[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.tasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search) ||
        task.description.toLowerCase().includes(search) ||
        (task.documentName && task.documentName.toLowerCase().includes(search)) ||
        (task.documentId && task.documentId.toLowerCase().includes(search));

      const matchesStatus =
        this.selectedStatus === 'All Status' ||
        task.status === this.selectedStatus;

      const matchesPriority =
        this.selectedPriority === 'All Priority' ||
        task.priority === this.selectedPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }

  get pendingCount(): number {
    return this.tasks.filter((task) => task.status === 'Pending').length;
  }

  get inProgressCount(): number {
    return this.tasks.filter((task) => task.status === 'In Progress').length;
  }

  get overdueCount(): number {
    return this.tasks.filter((task) => task.status === 'Overdue').length;
  }

  get completedCount(): number {
    return this.tasks.filter((task) => task.status === 'Completed').length;
  }

  openTask(task: TaskItem): void {
    this.selectedTask = task;
    this.showTaskPanel = true;
    this.loadComments(task.id);
  }

  closeTask(): void {
    this.selectedTask = null;
    this.showTaskPanel = false;
    this.taskComments.set([]);
  }

  loadComments(taskId: string): void {
    this.taskService.getTaskComments(taskId).subscribe({
      next: (comments) => {
        this.taskComments.set(comments);
      },
      error: () => {
        this.taskComments.set([]);
      },
    });
  }

  addComment(): void {
    if (!this.selectedTask || !this.newCommentText.trim()) return;
    this.isAddingComment.set(true);
    const text = this.newCommentText.trim();
    this.taskService.addTaskComment(this.selectedTask.id, text).subscribe({
      next: (comment) => {
        this.taskComments.update((list) => [...list, comment]);
        this.newCommentText = '';
        this.isAddingComment.set(false);
      },
      error: () => {
        this.isAddingComment.set(false);
      },
    });
  }

  startTask(): void {
    if (!this.selectedTask) return;
    this.updateTaskStatus(this.selectedTask, 'In Progress');
  }

  completeTask(): void {
    if (!this.selectedTask) return;
    this.updateTaskStatus(this.selectedTask, 'Completed');
  }

  updateTaskStatus(task: TaskItem, newStatus: 'Pending' | 'In Progress' | 'Completed'): void {
    const backendStatus = newStatus === 'In Progress' ? 'IN_PROGRESS' : newStatus.toUpperCase();
    this.taskService.updateTask(task.id, { status: backendStatus }).subscribe({
      next: () => {
        task.status = newStatus;
        if (this.selectedTask && this.selectedTask.id === task.id) {
          this.selectedTask.status = newStatus;
        }
      },
      error: () => {
        // Optimistic update fallback
        task.status = newStatus;
        if (this.selectedTask && this.selectedTask.id === task.id) {
          this.selectedTask.status = newStatus;
        }
      },
    });
  }

  openCreateTaskModal(): void {
    this.isEditing = false;
    this.editingTaskId = null;
    this.taskForm = {
      title: '',
      description: '',
      assignedTo: this.authService.getCurrentUser()?.id || '',
      dueDate: '',
      linkedDocumentId: '',
      priority: 'Medium',
      status: 'Pending',
    };
    this.formError = '';
    this.showCreateModal = true;
  }

  openEditTaskModal(task: TaskItem): void {
    this.isEditing = true;
    this.editingTaskId = task.id;
    this.taskForm = {
      title: task.title,
      description: task.description,
      assignedTo: task.assignedBy,
      dueDate: '',
      linkedDocumentId: task.documentId || '',
      priority: task.priority,
      status: task.status,
    };
    this.formError = '';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.formError = '';
  }

  saveTask(): void {
    if (!this.taskForm.title.trim()) {
      this.formError = 'Task title is required.';
      return;
    }

    this.isSavingTask.set(true);
    this.formError = '';

    if (this.isEditing && this.editingTaskId) {
      this.taskService
        .updateTask(this.editingTaskId, {
          title: this.taskForm.title.trim(),
          description: this.taskForm.description.trim(),
          assignedTo: this.taskForm.assignedTo || undefined,
          dueDate: this.taskForm.dueDate || undefined,
          priority: this.taskForm.priority,
          status: this.taskForm.status === 'In Progress' ? 'IN_PROGRESS' : this.taskForm.status.toUpperCase(),
        })
        .subscribe({
          next: () => {
            this.isSavingTask.set(false);
            this.closeCreateModal();
            this.loadTasks();
            if (this.selectedTask && this.selectedTask.id === this.editingTaskId) {
              this.selectedTask.title = this.taskForm.title;
              this.selectedTask.description = this.taskForm.description;
              this.selectedTask.priority = this.taskForm.priority as any;
            }
          },
          error: (err) => {
            this.formError = err?.error?.title || 'Failed to update task.';
            this.isSavingTask.set(false);
          },
        });
    } else {
      this.taskService
        .createTask({
          title: this.taskForm.title.trim(),
          description: this.taskForm.description.trim(),
          assignedTo: this.taskForm.assignedTo || undefined,
          dueDate: this.taskForm.dueDate || undefined,
          linkedDocumentId: this.taskForm.linkedDocumentId.trim() || undefined,
          priority: this.taskForm.priority,
        })
        .subscribe({
          next: () => {
            this.isSavingTask.set(false);
            this.closeCreateModal();
            this.loadTasks();
          },
          error: (err) => {
            this.formError = err?.error?.title || 'Failed to create task.';
            this.isSavingTask.set(false);
          },
        });
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'All Status';
    this.selectedPriority = 'All Priority';
    this.filterScope = 'all';
    this.loadTasks();
  }
}