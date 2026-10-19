import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_spacing.dart';

enum AppButtonVariant {
  primary,
  secondary,
  outline,
  text,
  danger,
}

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool isLoading;
  final IconData? icon;
  final double? width;
  final double height;

  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.icon,
    this.width,
    this.height = AppSpacing.minTouchTarget, // Enforce WCAG 48dp minimum
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    Color backgroundColor;
    Color foregroundColor;
    BorderSide borderSide = BorderSide.none;

    switch (variant) {
      case AppButtonVariant.primary:
        backgroundColor = AppColors.primary600;
        foregroundColor = Colors.white;
        break;
      case AppButtonVariant.secondary:
        backgroundColor = AppColors.slate700;
        foregroundColor = AppColors.slate100;
        break;
      case AppButtonVariant.outline:
        backgroundColor = Colors.transparent;
        foregroundColor = AppColors.primary500;
        borderSide = const BorderSide(color: AppColors.primary500, width: 1.5);
        break;
      case AppButtonVariant.text:
        backgroundColor = Colors.transparent;
        foregroundColor = AppColors.primary400;
        break;
      case AppButtonVariant.danger:
        backgroundColor = AppColors.error;
        foregroundColor = Colors.white;
        break;
    }

    final isButtonDisabled = onPressed == null || isLoading;

    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: isButtonDisabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          disabledBackgroundColor: AppColors.slate800,
          disabledForegroundColor: AppColors.slate500,
          elevation: 0,
          side: borderSide,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.borderMd),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  Text(
                    label,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: isButtonDisabled ? AppColors.slate500 : foregroundColor,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
