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

class TaskDetailScreen extends StatelessWidget {
  final String taskId;
  final TaskBloc? bloc;

  const TaskDetailScreen({
    super.key,
    required this.taskId,
    this.bloc,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<TaskBloc>.value(
        value: bloc!,
        child: _TaskDetailView(taskId: taskId),
      );
    }
    return BlocProvider<TaskBloc>(
      create: (_) => sl<TaskBloc>()..add(TaskDetailRequested(taskId)),
      child: _TaskDetailView(taskId: taskId),
    );
  }
}

class _TaskDetailView extends StatefulWidget {
  final String taskId;

  const _TaskDetailView({required this.taskId});

  @override
  State<_TaskDetailView> createState() => _TaskDetailViewState();
}

class _TaskDetailViewState extends State<_TaskDetailView> {
  final TextEditingController _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _postComment(BuildContext context) {
    final text = _commentController.text.trim();
    if (text.isNotEmpty) {
      context.read<TaskBloc>().add(TaskAddCommentRequested(
        taskId: widget.taskId,
        commentText: text,
      ));
      _commentController.clear();
      FocusScope.of(context).unfocus();
    }
  }

  void _updateStatus(BuildContext context, TaskStatus newStatus) {
    context.read<TaskBloc>().add(TaskUpdateRequested(
      taskId: widget.taskId,
      status: newStatus,
    ));
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
        final task = state.selectedTask;

        return AppScaffold(
          title: task != null ? task.taskId : 'Task Details',
          body: state.isLoadingDetail && task == null
              ? const Center(child: AppLoadingIndicator(message: 'Loading task details...'))
              : (state.errorMessage != null && task == null)
                  ? Center(
                      child: ErrorView(
                        title: 'Unable to load task',
                        message: state.errorMessage!,
                        onRetry: () =>
                            context.read<TaskBloc>().add(TaskDetailRequested(widget.taskId)),
                      ),
                    )
                  : task == null
                      ? const Center(
                          child: Text('Task not found', style: TextStyle(color: Colors.white)),
                        )
                      : Column(
                          children: [
                            Expanded(
                              child: SingleChildScrollView(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    // Task Overview Card
                                    _buildOverviewCard(context, task, state),
                                    const SizedBox(height: AppSpacing.md),

                                    // Linked Document banner (if linked)
                                    if (task.documentId != null && task.documentId!.isNotEmpty) ...[
                                      _buildLinkedDocumentCard(context, task.documentId!),
                                      const SizedBox(height: AppSpacing.md),
                                    ],

                                    // Collaboration Comments Thread Header
                                    Row(
                                      children: [
                                        const Icon(Icons.forum_outlined, size: 18, color: AppColors.primary400),
                                        const SizedBox(width: AppSpacing.xs),
                                        Text(
                                          'Collaboration Thread (${task.comments.length})',
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: AppSpacing.sm),

                                    // Comments List
                                    if (task.comments.isEmpty)
                                      Container(
                                        padding: const EdgeInsets.all(AppSpacing.md),
                                        decoration: BoxDecoration(
                                          color: AppColors.slate800,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Center(
                                          child: Text(
                                            'No comments yet. Start the conversation below.',
                                            style: TextStyle(color: AppColors.slate400, fontSize: 12),
                                          ),
                                        ),
                                      )
                                    else
                                      ...task.comments.map((comment) => _buildCommentItem(comment)),
                                  ],
                                ),
                              ),
                            ),

                            // Bottom Comment Composer
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                              decoration: const BoxDecoration(
                                color: AppColors.slate800,
                                border: Border(top: BorderSide(color: AppColors.slate700)),
                              ),
                              child: SafeArea(
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: _commentController,
                                        style: const TextStyle(color: Colors.white, fontSize: 13),
                                        decoration: const InputDecoration(
                                          hintText: 'Add a collaboration comment...',
                                          hintStyle: TextStyle(color: AppColors.slate500, fontSize: 12),
                                          border: InputBorder.none,
                                          contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      icon: state.isSubmittingAction
                                          ? const SizedBox(
                                              width: 16,
                                              height: 16,
                                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary400),
                                            )
                                          : const Icon(Icons.send_rounded, color: AppColors.primary500),
                                      onPressed: state.isSubmittingAction ? null : () => _postComment(context),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
        );
      },
    );
  }

  Widget _buildOverviewCard(BuildContext context, TaskItem task, TaskState state) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.slate700),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary900.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'PRIORITY: ${task.priority.displayName.toUpperCase()}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary400),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.slate700,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  task.status.displayName,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            task.title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          if (task.description != null && task.description!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              task.description!,
              style: const TextStyle(fontSize: 13, color: AppColors.slate300, height: 1.4),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          const Divider(color: AppColors.slate700),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Assignee: ${task.assigneeName ?? task.assigneeId ?? 'Unassigned'}',
                  style: const TextStyle(fontSize: 12, color: AppColors.slate300)),
              if (task.dueDate != null)
                Text(
                  'Due: ${task.dueDate!.day}/${task.dueDate!.month}/${task.dueDate!.year}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: task.isOverdue ? FontWeight.bold : FontWeight.normal,
                    color: task.isOverdue ? AppColors.error400 : AppColors.slate400,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Status Action Buttons
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              if (task.status != TaskStatus.inProgress)
                OutlinedButton.icon(
                  icon: const Icon(Icons.play_arrow, size: 14),
                  label: const Text('Start Work', style: TextStyle(fontSize: 11)),
                  onPressed: state.isSubmittingAction ? null : () => _updateStatus(context, TaskStatus.inProgress),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary400,
                    side: const BorderSide(color: AppColors.primary500),
                  ),
                ),
              if (task.status != TaskStatus.completed)
                OutlinedButton.icon(
                  icon: const Icon(Icons.check_circle_outline, size: 14),
                  label: const Text('Mark Complete', style: TextStyle(fontSize: 11)),
                  onPressed: state.isSubmittingAction ? null : () => _updateStatus(context, TaskStatus.completed),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.success400,
                    side: const BorderSide(color: AppColors.success500),
                  ),
                ),
              if (task.status != TaskStatus.open)
                OutlinedButton.icon(
                  icon: const Icon(Icons.replay, size: 14),
                  label: const Text('Re-open', style: TextStyle(fontSize: 11)),
                  onPressed: state.isSubmittingAction ? null : () => _updateStatus(context, TaskStatus.open),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.slate300,
                    side: const BorderSide(color: AppColors.slate600),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLinkedDocumentCard(BuildContext context, String documentId) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.slate850,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.slate700),
      ),
      child: Row(
        children: [
          const Icon(Icons.link, size: 18, color: AppColors.primary400),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Linked Document', style: TextStyle(fontSize: 11, color: AppColors.slate400)),
                Text(documentId, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
              ],
            ),
          ),
          TextButton(
            onPressed: () => context.push('/documents/$documentId'),
            child: const Text('View Doc', style: TextStyle(fontSize: 12, color: AppColors.primary400)),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentItem(TaskComment comment) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.slate700),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: AppColors.primary700,
                child: Text(
                  comment.authorName.isNotEmpty ? comment.authorName[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                comment.authorName,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
              ),
              const Spacer(),
              Text(
                '${comment.createdAt.hour}:${comment.createdAt.minute.toString().padLeft(2, '0')}',
                style: const TextStyle(fontSize: 10, color: AppColors.slate400),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            comment.commentText,
            style: const TextStyle(fontSize: 13, color: AppColors.slate200, height: 1.3),
          ),
        ],
      ),
    );
  }
}
