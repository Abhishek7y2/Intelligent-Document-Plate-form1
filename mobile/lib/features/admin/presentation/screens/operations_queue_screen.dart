import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../bloc/admin_bloc.dart';
import '../bloc/admin_event.dart';
import '../bloc/admin_state.dart';

class OperationsQueueScreen extends StatelessWidget {
  final AdminBloc? bloc;

  const OperationsQueueScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<AdminBloc>.value(
        value: bloc!,
        child: const _OperationsQueueView(),
      );
    }
    return BlocProvider<AdminBloc>(
      create: (_) => sl<AdminBloc>()..add(const AdminFetchOperationsDlqRequested()),
      child: const _OperationsQueueView(),
    );
  }
}

class _OperationsQueueView extends StatelessWidget {
  const _OperationsQueueView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AdminBloc, AdminState>(
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
          title: 'Operations Dead-Letter Queue',
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh, color: AppColors.slate300),
              tooltip: 'Refresh DLQ',
              onPressed: () {
                context.read<AdminBloc>().add(const AdminFetchOperationsDlqRequested());
              },
            ),
          ],
          body: _buildBody(context, state),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, AdminState state) {
    if (state.isLoadingDlq && state.dlqJobs.isEmpty) {
      return const Center(child: AppLoadingIndicator(message: 'Loading dead-letter queue...'));
    }

    if (state.isPermissionDenied) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_person_outlined, size: 48, color: AppColors.warning500),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Permission Denied',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                state.permissionDeniedMessage ?? 'Inspecting operations DLQ requires ADMIN_ACCESS permission.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.slate400),
              ),
            ],
          ),
        ),
      );
    }

    if (state.errorMessage != null && state.dlqJobs.isEmpty) {
      return Center(
        child: ErrorView(
          title: 'Unable to load operations DLQ',
          message: state.errorMessage!,
          onRetry: () => context.read<AdminBloc>().add(const AdminFetchOperationsDlqRequested()),
        ),
      );
    }

    if (state.dlqJobs.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async {
          context.read<AdminBloc>().add(const AdminFetchOperationsDlqRequested());
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
                    decoration: BoxDecoration(color: AppColors.slate800, shape: BoxShape.circle),
                    child: const Icon(Icons.check_circle_outline, size: 40, color: AppColors.success400),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Dead-Letter Queue is Empty', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: AppSpacing.xs),
                  const Text('All processing jobs executed cleanly without fatal exceptions.', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<AdminBloc>().add(const AdminFetchOperationsDlqRequested());
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: state.dlqJobs.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final job = state.dlqJobs[index];
          return Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate800,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.error700),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(job.id, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.error900.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.error600),
                      ),
                      child: Text('Retries: ${job.retryCount}', style: const TextStyle(fontSize: 10, color: AppColors.error300, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Document: ${job.documentId}', style: const TextStyle(fontSize: 12, color: AppColors.primary400)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: AppColors.slate900,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    job.failureReason,
                    style: const TextStyle(fontSize: 11, color: AppColors.error300, fontFamily: 'monospace'),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Correlation: ${job.correlationId.length > 16 ? job.correlationId.substring(0, 16) + '...' : job.correlationId}',
                      style: const TextStyle(fontSize: 10, color: AppColors.slate500),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.replay_rounded, size: 14),
                      label: const Text('Requeue Job', style: TextStyle(fontSize: 11)),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.primary400,
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: state.isSubmittingAction
                          ? null
                          : () {
                              context.read<AdminBloc>().add(AdminRetryDlqJobRequested(job.id));
                            },
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
