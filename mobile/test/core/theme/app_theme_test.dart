import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:docunexa_mobile/core/theme/app_colors.dart';
import 'package:docunexa_mobile/core/theme/app_radii.dart';
import 'package:docunexa_mobile/core/theme/app_spacing.dart';
import 'package:docunexa_mobile/core/theme/app_theme.dart';

void main() {
  group('AppTheme & Design Tokens Tests', () {
    test('Dark theme has correct brightness and primary color', () {
      final theme = AppTheme.darkTheme;
      expect(theme.brightness, equals(Brightness.dark));
      expect(theme.primaryColor, equals(AppColors.primary600));
      expect(theme.scaffoldBackgroundColor, equals(AppColors.slate900));
      expect(theme.colorScheme.surface, equals(AppColors.slate800));
    });

    test('Light theme has correct brightness and surface color', () {
      final theme = AppTheme.lightTheme;
      expect(theme.brightness, equals(Brightness.light));
      expect(theme.primaryColor, equals(AppColors.primary600));
      expect(theme.scaffoldBackgroundColor, equals(AppColors.slate50));
      expect(theme.colorScheme.surface, equals(Colors.white));
    });

    test('Spacing tokens enforce 48dp minimum touch target', () {
      expect(AppSpacing.minTouchTarget, equals(48.0));
      expect(AppSpacing.xs, equals(4.0));
      expect(AppSpacing.sm, equals(8.0));
      expect(AppSpacing.md, equals(16.0));
      expect(AppSpacing.lg, equals(24.0));
    });

    test('Radii tokens have standard border radius values', () {
      expect(AppRadii.xs, equals(4.0));
      expect(AppRadii.md, equals(8.0));
      expect(AppRadii.lg, equals(12.0));
      expect(AppRadii.xl, equals(16.0));
      expect(AppRadii.full, equals(9999.0));
    });
  });
}
