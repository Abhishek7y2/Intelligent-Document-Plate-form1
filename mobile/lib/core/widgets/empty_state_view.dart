import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import 'app_button.dart';

class EmptyStateView extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyStateView({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: const BoxDecoration(
                color: AppColors.slate800,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 48, color: AppColors.slate400),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate400),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: actionLabel!,
                onPressed: onAction,
                width: 180,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
