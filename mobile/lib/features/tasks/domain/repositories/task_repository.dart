import '../entities/task_entity.dart';

abstract class TaskRepository {
  Future<List<TaskItem>> getTasks({
    bool? mine,
    bool? overdue,
    TaskStatus? status,
    TaskPriority? priority,
  });

  Future<TaskItem> getTaskDetails(String taskId);

  Future<TaskItem> createTask({
    required String title,
    String? description,
    String? assigneeId,
    String? assigneeName,
    TaskPriority priority = TaskPriority.medium,
    DateTime? dueDate,
    String? documentId,
  });

  Future<TaskItem> updateTask({
    required String taskId,
    String? title,
    String? description,
    String? assigneeId,
    String? assigneeName,
    TaskStatus? status,
    TaskPriority? priority,
    DateTime? dueDate,
  });

  Future<TaskComment> addTaskComment({
    required String taskId,
    required String commentText,
  });

  Future<List<TaskComment>> getTaskComments(String taskId);
}
