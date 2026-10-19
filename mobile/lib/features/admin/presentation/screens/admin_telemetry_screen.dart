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

class AdminTelemetryScreen extends StatelessWidget {
  final AdminBloc? bloc;

  const AdminTelemetryScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<AdminBloc>.value(
        value: bloc!,
        child: const _AdminTelemetryView(),
      );
    }
    return BlocProvider<AdminBloc>(
      create: (_) => sl<AdminBloc>()..add(const AdminFetchTelemetryRequested()),
      child: const _AdminTelemetryView(),
    );
  }
}

class _AdminTelemetryView extends StatelessWidget {
  const _AdminTelemetryView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AdminBloc, AdminState>(
      builder: (context, state) {
        return AppScaffold(
          title: 'Operational Telemetry',
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh, color: AppColors.slate300),
              tooltip: 'Refresh Telemetry',
              onPressed: () {
                context.read<AdminBloc>().add(const AdminFetchTelemetryRequested());
              },
            ),
          ],
          body: _buildBody(context, state),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, AdminState state) {
    if (state.isLoadingTelemetry && state.telemetry == null) {
      return const Center(child: AppLoadingIndicator(message: 'Loading telemetry metrics...'));
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
                'Restricted Admin Feature',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                state.permissionDeniedMessage ?? 'Viewing operational telemetry is restricted to Administrators.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.slate400),
              ),
            ],
          ),
        ),
      );
    }

    if (state.errorMessage != null && state.telemetry == null) {
      return Center(
        child: ErrorView(
          title: 'Unable to load telemetry',
          message: state.errorMessage!,
          onRetry: () => context.read<AdminBloc>().add(const AdminFetchTelemetryRequested()),
        ),
      );
    }

    final t = state.telemetry;
    if (t == null) {
      return const Center(
        child: Text('No telemetry metrics available', style: TextStyle(color: Colors.white)),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<AdminBloc>().add(const AdminFetchTelemetryRequested());
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // System Health Card
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.slate800,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: t.isHealthy ? AppColors.success500 : AppColors.warning500,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    t.isHealthy ? Icons.check_circle_outline : Icons.warning_amber_rounded,
                    color: t.isHealthy ? AppColors.success400 : AppColors.warning400,
                    size: 28,
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'PLATFORM HEALTH: ${t.systemHealth.toUpperCase()}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: t.isHealthy ? AppColors.success400 : AppColors.warning400,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Last refreshed: ${t.lastRefreshed.hour}:${t.lastRefreshed.minute.toString().padLeft(2, '0')}:${t.lastRefreshed.second.toString().padLeft(2, '0')}',
                          style: const TextStyle(fontSize: 11, color: AppColors.slate400),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // 2x2 Operational KPI Tiles
            Row(
              children: [
                Expanded(child: _buildMetricTile('Total Documents', '${t.totalDocuments}', Icons.folder_copy_outlined, AppColors.primary400)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: _buildMetricTile('Processed Today', '${t.processedToday}', Icons.today_outlined, AppColors.success400)),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(child: _buildMetricTile('Review Tasks', '${t.activeReviewTasks}', Icons.rate_review_outlined, AppColors.warning400)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: _buildMetricTile('Pending Approvals', '${t.pendingApprovals}', Icons.assignment_turned_in_outlined, AppColors.primary400)),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            // Efficiency & Quality Cards
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.slate800,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.slate700),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Processing Quality & Automation', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: AppSpacing.sm),
                  _buildProgressRow(
                    label: 'Straight-Through Processing (STP)',
                    value: t.straightThroughProcessingRate,
                    display: '${(t.straightThroughProcessingRate * 100).toStringAsFixed(1)}%',
                    color: AppColors.success500,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _buildProgressRow(
                    label: 'Mean OCR Confidence',
                    value: t.averageConfidence,
                    display: '${(t.averageConfidence * 100).toStringAsFixed(1)}%',
                    color: AppColors.primary500,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Dead-Letter Queue Depth Card
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.slate800,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: t.deadLetterQueueDepth > 0 ? AppColors.error700 : AppColors.slate700),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    color: t.deadLetterQueueDepth > 0 ? AppColors.error400 : AppColors.slate400,
                    size: 24,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Operations Dead-Letter Queue (DLQ)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                        Text('${t.deadLetterQueueDepth} failed execution jobs pending retry', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, IconData icon, Color color) {
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
              Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _buildProgressRow({
    required String label,
    required double value,
    required String display,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate300)),
            Text(display, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
        const SizedBox(height: 6),
        LinearProgressIndicator(
          value: value.clamp(0.0, 1.0),
          backgroundColor: AppColors.slate700,
          color: color,
          minHeight: 6,
          borderRadius: BorderRadius.circular(3),
        ),
      ],
    );
  }
}
