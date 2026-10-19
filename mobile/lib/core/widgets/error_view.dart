import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import 'app_button.dart';

class ErrorView extends StatelessWidget {
  final String title;
  final String message;
  final String? correlationId;
  final VoidCallback? onRetry;
  final IconData icon;

  const ErrorView({
    super.key,
    this.title = 'Something Went Wrong',
    required this.message,
    this.correlationId,
    this.onRetry,
    this.icon = Icons.error_outline_rounded,
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
                color: Color(0x1AF43F5E), // 10% Rose
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 48, color: AppColors.error),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate400),
              textAlign: TextAlign.center,
            ),
            if (correlationId != null) ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: AppColors.slate800,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Trace ID: $correlationId',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                    color: AppColors.slate500,
                  ),
                ),
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: 'Try Again',
                icon: Icons.refresh_rounded,
                onPressed: onRetry,
                width: 160,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
