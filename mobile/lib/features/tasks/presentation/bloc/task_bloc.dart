import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/task_entity.dart';
import '../../domain/repositories/task_repository.dart';
import 'task_event.dart';
import 'task_state.dart';

class TaskBloc extends Bloc<TaskEvent, TaskState> {
  final TaskRepository repository;

  TaskBloc({required this.repository}) : super(const TaskState()) {
    on<TasksFetchRequested>(_onFetchRequested);
    on<TaskDetailRequested>(_onDetailRequested);
    on<TaskCreateRequested>(_onCreateRequested);
    on<TaskUpdateRequested>(_onUpdateRequested);
    on<TaskAddCommentRequested>(_onAddCommentRequested);
    on<TaskFilterChanged>(_onFilterChanged);
  }

  Future<void> _onFetchRequested(
    TasksFetchRequested event,
    Emitter<TaskState> emit,
  ) async {
    final mine = event.mine ?? state.mineOnly;
    final overdue = event.overdue ?? state.overdueOnly;
    final status = event.status ?? state.selectedStatus;
    final priority = event.priority ?? state.selectedPriority;

    emit(state.copyWith(
      isLoading: true,
      clearError: true,
      clearSuccess: true,
      mineOnly: mine,
      overdueOnly: overdue,
      selectedStatus: status,
      clearStatus: event.status == null && status == null,
      selectedPriority: priority,
      clearPriority: event.priority == null && priority == null,
    ));

    try {
      final tasks = await repository.getTasks(
        mine: mine,
        overdue: overdue,
        status: status,
        priority: priority,
      );

      emit(state.copyWith(
        isLoading: false,
        tasks: tasks,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onDetailRequested(
    TaskDetailRequested event,
    Emitter<TaskState> emit,
  ) async {
    emit(state.copyWith(isLoadingDetail: true, clearError: true));
    try {
      final task = await repository.getTaskDetails(event.taskId);
      emit(state.copyWith(
        isLoadingDetail: false,
        selectedTask: task,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoadingDetail: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onCreateRequested(
    TaskCreateRequested event,
    Emitter<TaskState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true, clearSuccess: true));
    try {
      final createdTask = await repository.createTask(
        title: event.title,
        description: event.description,
        assigneeId: event.assigneeId,
        assigneeName: event.assigneeName,
        priority: event.priority,
        dueDate: event.dueDate,
        documentId: event.documentId,
      );

      final updatedTasks = [createdTask, ...state.tasks];
      emit(state.copyWith(
        isSubmittingAction: false,
        tasks: updatedTasks,
        successMessage: 'Task created successfully',
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onUpdateRequested(
    TaskUpdateRequested event,
    Emitter<TaskState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true, clearSuccess: true));
    try {
      final updatedTask = await repository.updateTask(
        taskId: event.taskId,
        title: event.title,
        description: event.description,
        assigneeId: event.assigneeId,
        assigneeName: event.assigneeName,
        status: event.status,
        priority: event.priority,
        dueDate: event.dueDate,
      );

      final updatedList = state.tasks.map((t) {
        if (t.taskId == event.taskId) {
          return updatedTask;
        }
        return t;
      }).toList();

      emit(state.copyWith(
        isSubmittingAction: false,
        tasks: updatedList,
        selectedTask: state.selectedTask?.taskId == event.taskId
            ? updatedTask.copyWith(comments: state.selectedTask?.comments)
            : state.selectedTask,
        successMessage: 'Task updated successfully',
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  Future<void> _onAddCommentRequested(
    TaskAddCommentRequested event,
    Emitter<TaskState> emit,
  ) async {
    if (state.isSubmittingAction) return;
    emit(state.copyWith(isSubmittingAction: true, clearError: true));
    try {
      final newComment = await repository.addTaskComment(
        taskId: event.taskId,
        commentText: event.commentText,
      );

      if (state.selectedTask != null && state.selectedTask!.taskId == event.taskId) {
        final currentComments = List<TaskComment>.from(state.selectedTask!.comments)
          ..add(newComment);
        final updatedSelectedTask = state.selectedTask!.copyWith(comments: currentComments);

        emit(state.copyWith(
          isSubmittingAction: false,
          selectedTask: updatedSelectedTask,
          successMessage: 'Comment posted',
        ));
      } else {
        emit(state.copyWith(
          isSubmittingAction: false,
          successMessage: 'Comment posted',
        ));
      }
    } catch (e) {
      emit(state.copyWith(
        isSubmittingAction: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      ));
    }
  }

  void _onFilterChanged(
    TaskFilterChanged event,
    Emitter<TaskState> emit,
  ) {
    add(TasksFetchRequested(
      mine: event.mine,
      overdue: event.overdue,
      status: event.status,
      priority: event.priority,
    ));
  }
}
