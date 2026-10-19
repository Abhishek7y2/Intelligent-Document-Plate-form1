import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

class AppLoadingIndicator extends StatelessWidget {
  final String? message;
  final double size;

  const AppLoadingIndicator({
    super.key,
    this.message,
    this.size = 36.0,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: const CircularProgressIndicator(
              strokeWidth: 3.0,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary500),
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              message!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.slate400,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
