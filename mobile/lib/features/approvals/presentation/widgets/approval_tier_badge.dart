import 'package:flutter/material.dart';
import '../../domain/entities/approval_item.dart';

class ApprovalTierBadge extends StatelessWidget {
  final ApprovalTier tier;
  final bool showDescription;

  const ApprovalTierBadge({
    super.key,
    required this.tier,
    this.showDescription = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;
    String desc;

    switch (tier) {
      case ApprovalTier.tier1:
        bg = const Color(0xFFEFF6FF); // Blue-50
        fg = const Color(0xFF2563EB); // Blue-600
        label = 'TIER 1';
        desc = '1 Sign-off required (<$10k)';
        break;
      case ApprovalTier.tier2:
        bg = const Color(0xFFFEF3C7); // Amber-50
        fg = const Color(0xFFD97706); // Amber-600
        label = 'TIER 2';
        desc = '2 Sign-offs required ($10k-$50k)';
        break;
      case ApprovalTier.tier3:
        bg = const Color(0xFFFEE2E2); // Red-50
        fg = const Color(0xFFDC2626); // Red-600
        label = 'TIER 3';
        desc = '2 Executive Sign-offs required (>$50k)';
        break;
    }

    if (!showDescription) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: fg.withValues(alpha: 0.3)),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: fg),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 11),
              ),
              Text(
                desc,
                style: TextStyle(color: fg.withValues(alpha: 0.85), fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
