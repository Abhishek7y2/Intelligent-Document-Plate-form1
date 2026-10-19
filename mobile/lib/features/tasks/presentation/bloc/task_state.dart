import 'package:equatable/equatable.dart';
import '../../domain/entities/task_entity.dart';

class TaskState extends Equatable {
  final List<TaskItem> tasks;
  final TaskItem? selectedTask;
  final bool isLoading;
  final bool isLoadingDetail;
  final bool isSubmittingAction;
  final bool mineOnly;
  final bool overdueOnly;
  final TaskStatus? selectedStatus;
  final TaskPriority? selectedPriority;
  final String? errorMessage;
  final String? successMessage;

  const TaskState({
    this.tasks = const [],
    this.selectedTask,
    this.isLoading = false,
    this.isLoadingDetail = false,
    this.isSubmittingAction = false,
    this.mineOnly = false,
    this.overdueOnly = false,
    this.selectedStatus,
    this.selectedPriority,
    this.errorMessage,
    this.successMessage,
  });

  TaskState copyWith({
    List<TaskItem>? tasks,
    TaskItem? selectedTask,
    bool clearSelectedTask = false,
    bool? isLoading,
    bool? isLoadingDetail,
    bool? isSubmittingAction,
    bool? mineOnly,
    bool? overdueOnly,
    TaskStatus? selectedStatus,
    bool clearStatus = false,
    TaskPriority? selectedPriority,
    bool clearPriority = false,
    String? errorMessage,
    bool clearError = false,
    String? successMessage,
    bool clearSuccess = false,
  }) {
    return TaskState(
      tasks: tasks ?? this.tasks,
      selectedTask: clearSelectedTask ? null : (selectedTask ?? this.selectedTask),
      isLoading: isLoading ?? this.isLoading,
      isLoadingDetail: isLoadingDetail ?? this.isLoadingDetail,
      isSubmittingAction: isSubmittingAction ?? this.isSubmittingAction,
      mineOnly: mineOnly ?? this.mineOnly,
      overdueOnly: overdueOnly ?? this.overdueOnly,
      selectedStatus: clearStatus ? null : (selectedStatus ?? this.selectedStatus),
      selectedPriority: clearPriority ? null : (selectedPriority ?? this.selectedPriority),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }

  @override
  List<Object?> get props => [
        tasks,
        selectedTask,
        isLoading,
        isLoadingDetail,
        isSubmittingAction,
        mineOnly,
        overdueOnly,
        selectedStatus,
        selectedPriority,
        errorMessage,
        successMessage,
      ];
}
