import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_radii.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

class AppTheme {
  const AppTheme._();

  // Dark Theme (Default Enterprise Theme)
  static ThemeData get darkTheme {
    final textTheme = AppTypography.textTheme(AppColors.slate100);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: AppColors.primary600,
      scaffoldBackgroundColor: AppColors.slate900,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary600,
        onPrimary: Colors.white,
        secondary: AppColors.primary400,
        onSecondary: Colors.white,
        surface: AppColors.slate800,
        onSurface: AppColors.slate100,
        error: AppColors.error,
        onError: Colors.white,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.slate900,
        foregroundColor: AppColors.slate100,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardTheme(
        color: AppColors.slate800,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.borderLg,
          side: const BorderSide(color: AppColors.slate700, width: 1),
        ),
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.slate900,
        selectedItemColor: AppColors.primary500,
        unselectedItemColor: AppColors.slate400,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary600,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(AppSpacing.minTouchTarget),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadii.borderMd,
          ),
          textStyle: textTheme.labelLarge,
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.slate800,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadii.borderMd,
          borderSide: const BorderSide(color: AppColors.slate700),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.borderMd,
          borderSide: const BorderSide(color: AppColors.slate700),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.borderMd,
          borderSide: const BorderSide(color: AppColors.primary500, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.borderMd,
          borderSide: const BorderSide(color: AppColors.error),
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.slate500),
      ),
    );
  }

  // Light Theme
  static ThemeData get lightTheme {
    final textTheme = AppTypography.textTheme(AppColors.slate900);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: AppColors.primary600,
      scaffoldBackgroundColor: AppColors.slate50,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary600,
        onPrimary: Colors.white,
        secondary: AppColors.primary700,
        onSecondary: Colors.white,
        surface: Colors.white,
        onSurface: AppColors.slate900,
        error: AppColors.error,
        onError: Colors.white,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.slate900,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardTheme(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.borderLg,
          side: const BorderSide(color: AppColors.slate200, width: 1),
        ),
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.primary600,
        unselectedItemColor: AppColors.slate400,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary600,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(AppSpacing.minTouchTarget),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadii.borderMd,
          ),
          textStyle: textTheme.labelLarge,
          elevation: 0,
        ),
      ),
    );
  }
}
