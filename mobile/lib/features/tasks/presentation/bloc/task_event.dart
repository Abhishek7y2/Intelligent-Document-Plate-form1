import 'package:equatable/equatable.dart';
import '../../domain/entities/task_entity.dart';

abstract class TaskEvent extends Equatable {
  const TaskEvent();

  @override
  List<Object?> get props => [];
}

class TasksFetchRequested extends TaskEvent {
  final bool? mine;
  final bool? overdue;
  final TaskStatus? status;
  final TaskPriority? priority;

  const TasksFetchRequested({
    this.mine,
    this.overdue,
    this.status,
    this.priority,
  });

  @override
  List<Object?> get props => [mine, overdue, status, priority];
}

class TaskDetailRequested extends TaskEvent {
  final String taskId;

  const TaskDetailRequested(this.taskId);

  @override
  List<Object?> get props => [taskId];
}

class TaskCreateRequested extends TaskEvent {
  final String title;
  final String? description;
  final String? assigneeId;
  final String? assigneeName;
  final TaskPriority priority;
  final DateTime? dueDate;
  final String? documentId;

  const TaskCreateRequested({
    required this.title,
    this.description,
    this.assigneeId,
    this.assigneeName,
    this.priority = TaskPriority.medium,
    this.dueDate,
    this.documentId,
  });

  @override
  List<Object?> get props => [
        title,
        description,
        assigneeId,
        assigneeName,
        priority,
        dueDate,
        documentId,
      ];
}

class TaskUpdateRequested extends TaskEvent {
  final String taskId;
  final String? title;
  final String? description;
  final String? assigneeId;
  final String? assigneeName;
  final TaskStatus? status;
  final TaskPriority? priority;
  final DateTime? dueDate;

  const TaskUpdateRequested({
    required this.taskId,
    this.title,
    this.description,
    this.assigneeId,
    this.assigneeName,
    this.status,
    this.priority,
    this.dueDate,
  });

  @override
  List<Object?> get props => [
        taskId,
        title,
        description,
        assigneeId,
        assigneeName,
        status,
        priority,
        dueDate,
      ];
}

class TaskAddCommentRequested extends TaskEvent {
  final String taskId;
  final String commentText;

  const TaskAddCommentRequested({
    required this.taskId,
    required this.commentText,
  });

  @override
  List<Object?> get props => [taskId, commentText];
}

class TaskFilterChanged extends TaskEvent {
  final bool? mine;
  final bool? overdue;
  final TaskStatus? status;
  final TaskPriority? priority;

  const TaskFilterChanged({
    this.mine,
    this.overdue,
    this.status,
    this.priority,
  });

  @override
  List<Object?> get props => [mine, overdue, status, priority];
}
