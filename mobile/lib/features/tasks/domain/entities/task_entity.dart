import 'package:equatable/equatable.dart';

enum TaskStatus {
  open,
  inProgress,
  completed,
  resolved,
  closed;

  String get displayName {
    switch (this) {
      case TaskStatus.open:
        return 'Open';
      case TaskStatus.inProgress:
        return 'In Progress';
      case TaskStatus.completed:
        return 'Completed';
      case TaskStatus.resolved:
        return 'Resolved';
      case TaskStatus.closed:
        return 'Closed';
    }
  }

  static TaskStatus fromString(String status) {
    switch (status.toUpperCase()) {
      case 'IN_PROGRESS':
        return TaskStatus.inProgress;
      case 'COMPLETED':
        return TaskStatus.completed;
      case 'RESOLVED':
        return TaskStatus.resolved;
      case 'CLOSED':
        return TaskStatus.closed;
      default:
        return TaskStatus.open;
    }
  }
}

enum TaskPriority {
  low,
  medium,
  high,
  urgent;

  String get displayName {
    switch (this) {
      case TaskPriority.low:
        return 'Low';
      case TaskPriority.medium:
        return 'Medium';
      case TaskPriority.high:
        return 'High';
      case TaskPriority.urgent:
        return 'Urgent';
    }
  }

  static TaskPriority fromString(String priority) {
    switch (priority.toUpperCase()) {
      case 'LOW':
        return TaskPriority.low;
      case 'HIGH':
        return TaskPriority.high;
      case 'URGENT':
        return TaskPriority.urgent;
      default:
        return TaskPriority.medium;
    }
  }
}

class TaskComment extends Equatable {
  final String commentId;
  final String taskId;
  final String authorId;
  final String authorName;
  final String commentText;
  final DateTime createdAt;

  const TaskComment({
    required this.commentId,
    required this.taskId,
    required this.authorId,
    required this.authorName,
    required this.commentText,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [
        commentId,
        taskId,
        authorId,
        authorName,
        commentText,
        createdAt,
      ];
}

class TaskItem extends Equatable {
  final String taskId;
  final String tenantId;
  final String? documentId;
  final String title;
  final String? description;
  final String? assigneeId;
  final String? assigneeName;
  final TaskStatus status;
  final TaskPriority priority;
  final DateTime? dueDate;
  final String? createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<TaskComment> comments;

  const TaskItem({
    required this.taskId,
    required this.tenantId,
    this.documentId,
    required this.title,
    this.description,
    this.assigneeId,
    this.assigneeName,
    required this.status,
    required this.priority,
    this.dueDate,
    this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.comments = const [],
  });

  bool get isOverdue {
    if (dueDate == null) return false;
    if (status == TaskStatus.completed ||
        status == TaskStatus.resolved ||
        status == TaskStatus.closed) {
      return false;
    }
    return dueDate!.isBefore(DateTime.now());
  }

  TaskItem copyWith({
    String? taskId,
    String? tenantId,
    String? documentId,
    String? title,
    String? description,
    String? assigneeId,
    String? assigneeName,
    TaskStatus? status,
    TaskPriority? priority,
    DateTime? dueDate,
    String? createdBy,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<TaskComment>? comments,
  }) {
    return TaskItem(
      taskId: taskId ?? this.taskId,
      tenantId: tenantId ?? this.tenantId,
      documentId: documentId ?? this.documentId,
      title: title ?? this.title,
      description: description ?? this.description,
      assigneeId: assigneeId ?? this.assigneeId,
      assigneeName: assigneeName ?? this.assigneeName,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      dueDate: dueDate ?? this.dueDate,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      comments: comments ?? this.comments,
    );
  }

  @override
  List<Object?> get props => [
        taskId,
        tenantId,
        documentId,
        title,
        description,
        assigneeId,
        assigneeName,
        status,
        priority,
        dueDate,
        createdBy,
        createdAt,
        updatedAt,
        comments,
      ];
}
