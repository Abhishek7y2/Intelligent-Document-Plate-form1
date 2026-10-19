import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  // Primary Palette - Deep Indigo
  static const Color primary50 = Color(0xFFEEF2FF);
  static const Color primary100 = Color(0xFFE0E7FF);
  static const Color primary200 = Color(0xFFC7D2FE);
  static const Color primary300 = Color(0xFFA5B4FC);
  static const Color primary400 = Color(0xFF818CF8);
  static const Color primary500 = Color(0xFF6366F1);
  static const Color primary600 = Color(0xFF4F46E5); // Brand Accent
  static const Color primary700 = Color(0xFF4338CA);
  static const Color primary800 = Color(0xFF3730A3);
  static const Color primary900 = Color(0xFF312E81);

  // Neutral Palette - Slate Dark Mode & Surface
  static const Color slate50 = Color(0xFFF8FAFC);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B); // Dark Surface
  static const Color slate900 = Color(0xFF0F172A); // Dark Background
  static const Color slate950 = Color(0xFF020617);

  // Status & Semantic Colors
  static const Color success = Color(0xFF10B981); // Emerald
  static const Color successLight = Color(0xFFD1FAE5);
  static const Color warning = Color(0xFFF59E0B); // Amber
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFF43F5E); // Rose
  static const Color errorLight = Color(0xFFFFE4E6);
  static const Color info = Color(0xFF0284C7); // Sky
  static const Color infoLight = Color(0xFFE0F2FE);

  // Confidence Gauges
  static const Color confidenceHigh = Color(0xFF10B981); // >= 90%
  static const Color confidenceMedium = Color(0xFFF59E0B); // 70% - 89%
  static const Color confidenceLow = Color(0xFFF43F5E); // < 70%

  // Overlay & Shimmer
  static const Color shimmerBase = Color(0xFF1E293B);
  static const Color shimmerHighlight = Color(0xFF334155);
}
