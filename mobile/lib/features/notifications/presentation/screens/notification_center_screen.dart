import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/notification_item.dart';
import '../bloc/notification_bloc.dart';
import '../bloc/notification_event.dart';
import '../bloc/notification_state.dart';

class NotificationCenterScreen extends StatelessWidget {
  final NotificationBloc? bloc;

  const NotificationCenterScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<NotificationBloc>.value(
        value: bloc!,
        child: const _NotificationCenterView(),
      );
    }
    return BlocProvider<NotificationBloc>(
      create: (_) => sl<NotificationBloc>()..add(const NotificationsFetchRequested()),
      child: const _NotificationCenterView(),
    );
  }
}

class _NotificationCenterView extends StatelessWidget {
  const _NotificationCenterView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<NotificationBloc, NotificationState>(
      builder: (context, state) {
        return AppScaffold(
          title: 'Notification Center',
          actions: [
            if (state.unreadCount > 0)
              TextButton(
                onPressed: state.isUpdating
                    ? null
                    : () => context.read<NotificationBloc>().add(const NotificationMarkAllReadRequested()),
                child: state.isUpdating
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary400),
                      )
                    : const Text(
                        'Mark all read',
                        style: TextStyle(color: AppColors.primary400, fontSize: 13),
                      ),
              ),
          ],
          body: Column(
            children: [
              // Category filter bar
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    FilterChip(
                      label: Text('All (${state.notifications.length})'),
                      selected: state.selectedCategory == null,
                      onSelected: (_) => context.read<NotificationBloc>().add(
                            const NotificationFilterChanged(category: null),
                          ),
                      selectedColor: AppColors.primary600,
                      labelStyle: TextStyle(
                        color: state.selectedCategory == null ? Colors.white : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    ...NotificationCategory.values.map((cat) {
                      final isSelected = state.selectedCategory == cat;
                      return Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.xs),
                        child: FilterChip(
                          label: Text(cat.displayName),
                          selected: isSelected,
                          onSelected: (_) => context.read<NotificationBloc>().add(
                                NotificationFilterChanged(category: cat),
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
                    const SizedBox(width: AppSpacing.xs),
                    FilterChip(
                      avatar: Icon(
                        state.unreadOnly ? Icons.check_circle : Icons.circle_outlined,
                        size: 14,
                        color: state.unreadOnly ? Colors.white : AppColors.slate400,
                      ),
                      label: Text('Unread (${state.unreadCount})'),
                      selected: state.unreadOnly,
                      onSelected: (val) => context.read<NotificationBloc>().add(
                            NotificationFilterChanged(unreadOnly: val),
                          ),
                      selectedColor: AppColors.primary700,
                      labelStyle: TextStyle(
                        color: state.unreadOnly ? Colors.white : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                  ],
                ),
              ),
              const Divider(color: AppColors.slate800, height: 1),

              // Content Area
              Expanded(
                child: _buildContent(context, state),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildContent(BuildContext context, NotificationState state) {
    if (state.isLoading && state.notifications.isEmpty) {
      return const Center(child: AppLoadingIndicator(message: 'Loading notifications...'));
    }

    if (state.errorMessage != null && state.notifications.isEmpty) {
      return Center(
        child: ErrorView(
          title: 'Unable to load notifications',
          message: state.errorMessage!,
          onRetry: () => context.read<NotificationBloc>().add(const NotificationsFetchRequested()),
        ),
      );
    }

    if (state.notifications.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async {
          context.read<NotificationBloc>().add(const NotificationsFetchRequested());
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
                    child: const Icon(Icons.notifications_off_outlined, size: 40, color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'No notifications in this view',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text(
                    'You are all caught up on system events and tasks.',
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
        context.read<NotificationBloc>().add(const NotificationsFetchRequested());
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        itemCount: state.notifications.length,
        separatorBuilder: (_, __) => const Divider(color: AppColors.slate800, height: 1),
        itemBuilder: (context, index) {
          final item = state.notifications[index];
          return _NotificationTile(
            item: item,
            onTap: () {
              if (!item.read) {
                context.read<NotificationBloc>().add(NotificationMarkReadRequested(item.id));
              }
              if (item.targetUrl != null && item.targetUrl!.isNotEmpty) {
                final target = item.targetUrl!;
                // Standardize target url to match mobile router paths
                if (target.startsWith('/')) {
                  context.push(target);
                } else {
                  context.push('/$target');
                }
              }
            },
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationItem item;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.item,
    required this.onTap,
  });

  IconData _getIcon() {
    switch (item.category) {
      case NotificationCategory.tasks:
        return Icons.task_alt_rounded;
      case NotificationCategory.approvals:
        return Icons.assignment_turned_in_rounded;
      case NotificationCategory.failures:
        return Icons.error_outline_rounded;
      case NotificationCategory.expiry:
        return Icons.timer_outlined;
      case NotificationCategory.general:
        return Icons.notifications_none_rounded;
    }
  }

  Color _getSeverityColor() {
    switch (item.severity) {
      case NotificationSeverity.error:
        return AppColors.error500;
      case NotificationSeverity.warning:
        return AppColors.warning500;
      case NotificationSeverity.success:
        return AppColors.success500;
      case NotificationSeverity.info:
        return AppColors.primary400;
    }
  }

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final sevColor = _getSeverityColor();

    return Material(
      color: item.read ? Colors.transparent : AppColors.slate800.withValues(alpha: 0.6),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon Badge
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: sevColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(_getIcon(), size: 20, color: sevColor),
              ),
              const SizedBox(width: AppSpacing.sm),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: item.read ? FontWeight.w500 : FontWeight.bold,
                              color: Colors.white,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          _formatTime(item.createdAt),
                          style: const TextStyle(fontSize: 11, color: AppColors.slate400),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.message,
                      style: const TextStyle(fontSize: 12, color: AppColors.slate300, height: 1.3),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (item.targetUrl != null && item.targetUrl!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.arrow_forward_rounded, size: 12, color: AppColors.primary400),
                          const SizedBox(width: 4),
                          Text(
                            'Open ${item.category.displayName}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.primary400,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              // Unread indicator dot
              if (!item.read)
                Container(
                  margin: const EdgeInsets.only(left: AppSpacing.xs, top: 4),
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.primary500,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
