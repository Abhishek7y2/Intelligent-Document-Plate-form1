import 'package:flutter/material.dart';

/// Implements 100% visual and logical parity with Angular's `StatusBadge` component.
/// Displays document lifecycle statuses with colored backgrounds, borders, and status dot indicators.
class AppStatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;
  final EdgeInsetsGeometry padding;

  const AppStatusBadge({
    super.key,
    required this.status,
    this.fontSize = 11.0,
    this.padding = const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.5),
  });

  @override
  Widget build(BuildContext context) {
    final style = _resolveStatusStyle(status);

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: style.backgroundColor,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(color: style.borderColor, width: 1.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6.0,
            height: 6.0,
            decoration: BoxDecoration(
              color: style.dotColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5.0),
          Text(
            style.displayLabel,
            style: TextStyle(
              color: style.textColor,
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
              decoration: style.isPurged ? TextDecoration.lineThrough : null,
            ),
          ),
        ],
      ),
    );
  }

  _StatusStyle _resolveStatusStyle(String rawStatus) {
    final raw = rawStatus.toLowerCase().trim();

    if (raw.contains('approved') || raw.contains('published')) {
      return const _StatusStyle(
        displayLabel: 'Approved/Published',
        backgroundColor: Color(0xFF064E3B), // Dark theme Emerald surface
        textColor: Color(0xFF34D399),
        borderColor: Color(0xFF059669),
        dotColor: Color(0xFF10B981),
      );
    }
    if (raw.contains('pending')) {
      return const _StatusStyle(
        displayLabel: 'Pending Approval',
        backgroundColor: Color(0xFF713F12), // Dark theme Amber surface
        textColor: Color(0xFFFDE047),
        borderColor: Color(0xFFCA8A04),
        dotColor: Color(0xFFFACC15),
      );
    }
    if (raw.contains('quarantine')) {
      return const _StatusStyle(
        displayLabel: 'Quarantined',
        backgroundColor: Color(0xFF7F1D1D), // Dark Rose
        textColor: Color(0xFFFCA5A5),
        borderColor: Color(0xFFDC2626),
        dotColor: Color(0xFFEF4444),
      );
    }
    if (raw.contains('process')) {
      return const _StatusStyle(
        displayLabel: 'Processing',
        backgroundColor: Color(0xFF4C1D95), // Dark Purple
        textColor: Color(0xFFDDD6FE),
        borderColor: Color(0xFF7C3AED),
        dotColor: Color(0xFF8B5CF6),
      );
    }
    if (raw.contains('review')) {
      return const _StatusStyle(
        displayLabel: 'In Review',
        backgroundColor: Color(0xFF78350F), // Dark Amber
        textColor: Color(0xFFFDE68A),
        borderColor: Color(0xFFD97706),
        dotColor: Color(0xFFF59E0B),
      );
    }
    if (raw.contains('supersede')) {
      return const _StatusStyle(
        displayLabel: 'Superseded',
        backgroundColor: Color(0xFF1E293B), // Slate 800
        textColor: Color(0xFF94A3B8),
        borderColor: Color(0xFF475569),
        dotColor: Color(0xFF64748B),
      );
    }
    if (raw.contains('reject')) {
      return const _StatusStyle(
        displayLabel: 'Rejected',
        backgroundColor: Color(0xFF7F1D1D),
        textColor: Color(0xFFFCA5A5),
        borderColor: Color(0xFFDC2626),
        dotColor: Color(0xFFEF4444),
      );
    }
    if (raw.contains('held') || raw.contains('hold')) {
      return const _StatusStyle(
        displayLabel: 'Legal Hold',
        backgroundColor: Color(0xFF7C2D12), // Dark Orange
        textColor: Color(0xFFFFEDD5),
        borderColor: Color(0xFFEA580C),
        dotColor: Color(0xFFF97316),
      );
    }
    if (raw.contains('expire')) {
      return const _StatusStyle(
        displayLabel: 'Expired',
        backgroundColor: Color(0xFF1E293B),
        textColor: Color(0xFF94A3B8),
        borderColor: Color(0xFF334155),
        dotColor: Color(0xFF64748B),
      );
    }
    if (raw.contains('purge')) {
      return const _StatusStyle(
        displayLabel: 'Purged',
        backgroundColor: Color(0xFF0F172A),
        textColor: Color(0xFF64748B),
        borderColor: Color(0xFF1E293B),
        dotColor: Color(0xFF475569),
        isPurged: true,
      );
    }
    if (raw.contains('validate')) {
      return const _StatusStyle(
        displayLabel: 'Validated',
        backgroundColor: Color(0xFF1E3A8A), // Dark Blue
        textColor: Color(0xFFBFDBFE),
        borderColor: Color(0xFF2563EB),
        dotColor: Color(0xFF3B82F6),
      );
    }

    // Default: Received
    return _StatusStyle(
      displayLabel: rawStatus.isEmpty ? 'Received' : rawStatus,
      backgroundColor: const Color(0xFF1E293B),
      textColor: const Color(0xFFCBD5E1),
      borderColor: const Color(0xFF334155),
      dotColor: const Color(0xFF94A3B8),
    );
  }
}

class _StatusStyle {
  final String displayLabel;
  final Color backgroundColor;
  final Color textColor;
  final Color borderColor;
  final Color dotColor;
  final bool isPurged;

  const _StatusStyle({
    required this.displayLabel,
    required this.backgroundColor,
    required this.textColor,
    required this.borderColor,
    required this.dotColor,
    this.isPurged = false,
  });
}
