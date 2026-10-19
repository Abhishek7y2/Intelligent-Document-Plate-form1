import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/task_entity.dart';
import '../bloc/task_bloc.dart';
import '../bloc/task_event.dart';
import '../bloc/task_state.dart';

class TasksScreen extends StatelessWidget {
  final TaskBloc? bloc;

  const TasksScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<TaskBloc>.value(
        value: bloc!,
        child: const _TasksView(),
      );
    }
    return BlocProvider<TaskBloc>(
      create: (_) => sl<TaskBloc>()..add(const TasksFetchRequested()),
      child: const _TasksView(),
    );
  }
}

class _TasksView extends StatelessWidget {
  const _TasksView();

  void _showCreateTaskDialog(BuildContext context) {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final assigneeController = TextEditingController();
    TaskPriority selectedPriority = TaskPriority.medium;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.slate900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.md,
                right: AppSpacing.md,
                top: AppSpacing.md,
                bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Create New Task',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.slate400),
                          onPressed: () => Navigator.pop(sheetContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: titleController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Task Title *',
                        labelStyle: const TextStyle(color: AppColors.slate400),
                        filled: true,
                        fillColor: AppColors.slate800,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: descController,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Description (optional)',
                        labelStyle: const TextStyle(color: AppColors.slate400),
                        filled: true,
                        fillColor: AppColors.slate800,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: assigneeController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Assignee Name or ID (optional)',
                        labelStyle: const TextStyle(color: AppColors.slate400),
                        filled: true,
                        fillColor: AppColors.slate800,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        const Text('Priority: ', style: TextStyle(color: AppColors.slate300, fontSize: 13)),
                        const SizedBox(width: AppSpacing.sm),
                        DropdownButton<TaskPriority>(
                          value: selectedPriority,
                          dropdownColor: AppColors.slate800,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          items: TaskPriority.values.map((p) {
                            return DropdownMenuItem(
                              value: p,
                              child: Text(p.displayName),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setSheetState(() => selectedPriority = val);
                            }
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppButton(
                      label: 'Create Task',
                      onPressed: () {
                        final title = titleController.text.trim();
                        if (title.isNotEmpty) {
                          context.read<TaskBloc>().add(TaskCreateRequested(
                            title: title,
                            description: descController.text.trim(),
                            assigneeName: assigneeController.text.trim().isNotEmpty
                                ? assigneeController.text.trim()
                                : null,
                            priority: selectedPriority,
                          ));
                          Navigator.pop(sheetContext);
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TaskBloc, TaskState>(
      listener: (context, state) {
        if (state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: AppColors.success600,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      },
      builder: (context, state) {
        return AppScaffold(
          title: 'Tasks & Collaboration',
          floatingActionButton: FloatingActionButton(
            onPressed: () => _showCreateTaskDialog(context),
            backgroundColor: AppColors.primary600,
            foregroundColor: Colors.white,
            tooltip: 'New Task',
            child: const Icon(Icons.add_task_rounded),
          ),
          body: Column(
            children: [
              // Filter chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    FilterChip(
                      label: Text('All (${state.tasks.length})'),
                      selected: !state.mineOnly && !state.overdueOnly && state.selectedStatus == null,
                      onSelected: (_) => context.read<TaskBloc>().add(
                            const TaskFilterChanged(mine: false, overdue: false, status: null),
                          ),
                      selectedColor: AppColors.primary600,
                      labelStyle: TextStyle(
                        color: !state.mineOnly && !state.overdueOnly && state.selectedStatus == null
                            ? Colors.white
                            : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    FilterChip(
                      label: const Text('Assigned to Me'),
                      selected: state.mineOnly,
                      onSelected: (val) => context.read<TaskBloc>().add(
                            TaskFilterChanged(mine: val),
                          ),
                      selectedColor: AppColors.primary600,
                      labelStyle: TextStyle(
                        color: state.mineOnly ? Colors.white : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    FilterChip(
                      label: const Text('Overdue'),
                      selected: state.overdueOnly,
                      onSelected: (val) => context.read<TaskBloc>().add(
                            TaskFilterChanged(overdue: val),
                          ),
                      selectedColor: AppColors.error700,
                      labelStyle: TextStyle(
                        color: state.overdueOnly ? Colors.white : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    ...TaskStatus.values.map((status) {
                      final isSelected = state.selectedStatus == status;
                      return Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.xs),
                        child: FilterChip(
                          label: Text(status.displayName),
                          selected: isSelected,
                          onSelected: (_) => context.read<TaskBloc>().add(
                                TaskFilterChanged(status: isSelected ? null : status),
                              ),
                          selectedColor: AppColors.primary600,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.slate300,
                            fontSize: 12,
                          ),
                          backgroundColor: AppColors.slate800,
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const Divider(color: AppColors.slate800, height: 1),

              // Tasks List Area
              Expanded(
                child: _buildTasksList(context, state),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTasksList(BuildContext context, TaskState state) {
    if (state.isLoading && state.tasks.isEmpty) {
      return const Center(child: AppLoadingIndicator(message: 'Loading tasks...'));
    }

    if (state.errorMessage != null && state.tasks.isEmpty) {
      return Center(
        child: ErrorView(
          title: 'Unable to load tasks',
          message: state.errorMessage!,
          onRetry: () => context.read<TaskBloc>().add(const TasksFetchRequested()),
        ),
      );
    }

    if (state.tasks.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async {
          context.read<TaskBloc>().add(const TasksFetchRequested());
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.slate800,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.assignment_outlined, size: 40, color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'No tasks found',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text(
                    'Create a new task using the + button below.',
                    style: TextStyle(color: AppColors.slate400, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<TaskBloc>().add(const TasksFetchRequested());
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: state.tasks.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final task = state.tasks[index];
          return _TaskCard(
            task: task,
            onTap: () {
              context.push('/tasks/${task.taskId}');
            },
          );
        },
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final TaskItem task;
  final VoidCallback onTap;

  const _TaskCard({
    required this.task,
    required this.onTap,
  });

  Color _getPriorityColor() {
    switch (task.priority) {
      case TaskPriority.urgent:
      case TaskPriority.high:
        return AppColors.error500;
      case TaskPriority.medium:
        return AppColors.warning500;
      case TaskPriority.low:
        return AppColors.slate400;
    }
  }

  Color _getStatusColor() {
    switch (task.status) {
      case TaskStatus.completed:
      case TaskStatus.resolved:
      case TaskStatus.closed:
        return AppColors.success500;
      case TaskStatus.inProgress:
        return AppColors.primary400;
      case TaskStatus.open:
        return AppColors.warning500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOverdue = task.isOverdue;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isOverdue ? AppColors.error500 : AppColors.slate700,
          width: isOverdue ? 1.5 : 1.0,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Priority + Status Pill
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: _getPriorityColor(),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          task.priority.displayName.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _getPriorityColor(),
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getStatusColor().withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _getStatusColor().withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        task.status.displayName,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _getStatusColor(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),

                // Title
                Text(
                  task.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),

                if (task.description != null && task.description!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    task.description!,
                    style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],

                const SizedBox(height: AppSpacing.sm),

                // Footer row: Assignee, Due date, Comments count
                Row(
                  children: [
                    if (task.assigneeName != null || task.assigneeId != null) ...[
                      const Icon(Icons.person_outline, size: 14, color: AppColors.slate400),
                      const SizedBox(width: 4),
                      Text(
                        task.assigneeName ?? task.assigneeId!,
                        style: const TextStyle(fontSize: 11, color: AppColors.slate300),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    if (task.dueDate != null) ...[
                      Icon(
                        Icons.schedule,
                        size: 14,
                        color: isOverdue ? AppColors.error400 : AppColors.slate400,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isOverdue
                            ? 'Overdue (${task.dueDate!.day}/${task.dueDate!.month})'
                            : 'Due: ${task.dueDate!.day}/${task.dueDate!.month}/${task.dueDate!.year}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isOverdue ? FontWeight.bold : FontWeight.normal,
                          color: isOverdue ? AppColors.error400 : AppColors.slate400,
                        ),
                      ),
                    ],
                    const Spacer(),
                    const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.slate500),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
