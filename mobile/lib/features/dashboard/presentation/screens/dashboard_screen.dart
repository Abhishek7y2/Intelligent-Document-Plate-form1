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
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../../domain/entities/dashboard_kpi.dart';
import '../bloc/dashboard_bloc.dart';
import '../bloc/dashboard_event.dart';
import '../bloc/dashboard_state.dart';

class DashboardScreen extends StatelessWidget {
  final DashboardBloc? bloc;

  const DashboardScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<DashboardBloc>.value(
        value: bloc!,
        child: const _DashboardView(),
      );
    }
    return BlocProvider<DashboardBloc>(
      create: (_) => sl<DashboardBloc>()..add(const DashboardFetchRequested()),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppScaffold(
      title: 'Operations Dashboard',
      actions: [
        IconButton(
          icon: const Icon(Icons.notifications_outlined, color: AppColors.slate300),
          tooltip: 'Notification Center',
          onPressed: () => context.push('/notifications'),
        ),
      ],
      body: BlocBuilder<DashboardBloc, DashboardState>(
        builder: (context, state) {
          if (state is DashboardLoading || state is DashboardInitial) {
            return const Center(
              child: AppLoadingIndicator(message: 'Aggregating operational metrics...'),
            );
          }

          if (state is DashboardError) {
            return Center(
              child: ErrorView(
                title: 'Unable to load operational dashboard',
                message: state.message,
                correlationId: state.correlationId,
                onRetry: () =>
                    context.read<DashboardBloc>().add(const DashboardFetchRequested()),
              ),
            );
          }

          final summary = (state as DashboardLoaded).summary;

          return RefreshIndicator(
            onRefresh: () async {
              context.read<DashboardBloc>().add(const DashboardRefreshRequested());
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Greeting & Tenant Header
                  _buildHeader(context),
                  const SizedBox(height: AppSpacing.md),

                  // 2x2 Operational KPI Grid
                  _buildKpiGrid(context, summary),
                  const SizedBox(height: AppSpacing.lg),

                  // Status Distribution Card
                  _buildStatusDistributionCard(context, summary),
                  const SizedBox(height: AppSpacing.lg),

                  // Quick Action Navigation Shortcuts
                  _buildQuickActions(context),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, authState) {
        String userName = 'Document Specialist';
        String tenantId = 'Enterprise Scope';
        String userRole = 'Analyst';

        if (authState is Authenticated) {
          userName = authState.user.fullName;
          tenantId = authState.user.tenantId;
          userRole = authState.user.role;
        }

        return Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.slate900,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.slate800),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.primary900.withOpacity(0.5),
                child: const Icon(
                  Icons.auto_graph_rounded,
                  color: AppColors.primary400,
                  size: 26,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, $userName',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$userRole • $tenantId',
                      style: const TextStyle(
                        color: AppColors.slate400,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildKpiGrid(BuildContext context, DashboardSummary summary) {
    final cards = summary.kpis;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: cards.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: AppSpacing.sm,
        mainAxisSpacing: AppSpacing.sm,
        childAspectRatio: 1.25,
      ),
      itemBuilder: (context, index) {
        final card = cards[index];
        return _buildKpiCard(context, card);
      },
    );
  }

  Widget _buildKpiCard(BuildContext context, KpiCard card) {
    Color valueColor = Colors.white;
    if (card.label.toLowerCase().contains('exception') && (card.value != 0 && card.value != '0')) {
      valueColor = AppColors.rose400;
    } else if (card.label.toLowerCase().contains('straight') || card.label.toLowerCase().contains('rate')) {
      valueColor = AppColors.emerald400;
    }

    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              card.label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.slate400,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              card.value.toString(),
              style: TextStyle(
                color: valueColor,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              card.subtext.isNotEmpty ? card.subtext : 'Operational Metric',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.slate500,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusDistributionCard(
    BuildContext context,
    DashboardSummary summary,
  ) {
    final dist = summary.statusDistribution;
    final approved = dist['Approved'] ?? 0;
    final underReview = dist['Under Review'] ?? 0;
    final pendingApproval = dist['Pending Approval'] ?? 0;
    final quarantined = dist['Quarantined'] ?? 0;
    final total = approved + underReview + pendingApproval + quarantined;

    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Processing Distribution',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '$total Total',
                  style: const TextStyle(
                    color: AppColors.slate400,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            // Segmented Distribution Bar
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 10,
                child: total == 0
                    ? Container(color: AppColors.slate700)
                    : Row(
                        children: [
                          if (approved > 0)
                            Expanded(
                              flex: approved,
                              child: Container(color: AppColors.emerald500),
                            ),
                          if (underReview > 0)
                            Expanded(
                              flex: underReview,
                              child: Container(color: AppColors.amber500),
                            ),
                          if (pendingApproval > 0)
                            Expanded(
                              flex: pendingApproval,
                              child: Container(color: AppColors.primary500),
                            ),
                          if (quarantined > 0)
                            Expanded(
                              flex: quarantined,
                              child: Container(color: AppColors.rose500),
                            ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Distribution Legend
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.xs,
              children: [
                _buildLegendItem('Approved', approved, AppColors.emerald400),
                _buildLegendItem('Under Review', underReview, AppColors.amber400),
                _buildLegendItem('Pending Approval', pendingApproval, AppColors.primary400),
                _buildLegendItem('Exceptions', quarantined, AppColors.rose400),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem(String label, int count, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '$label: $count',
          style: const TextStyle(color: AppColors.slate300, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Quick Workflows',
          style: TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Explore Document Catalog',
          icon: Icons.folder_open_rounded,
          variant: AppButtonVariant.primary,
          onPressed: () {
            context.go('/documents');
          },
        ),
        const SizedBox(height: AppSpacing.xs),
        AppButton(
          label: 'Grounded Document Q&A',
          icon: Icons.psychology_outlined,
          variant: AppButtonVariant.secondary,
          onPressed: () {
            context.push('/qa');
          },
        ),
        const SizedBox(height: AppSpacing.xs),
        AppButton(
          label: 'Team Tasks & Collaboration',
          icon: Icons.assignment_outlined,
          variant: AppButtonVariant.secondary,
          onPressed: () {
            context.push('/tasks');
          },
        ),
      ],
    );
  }
}
