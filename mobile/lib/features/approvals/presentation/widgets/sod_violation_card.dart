import 'package:flutter/material.dart';

class SodViolationCard extends StatelessWidget {
  final String title;
  final String message;
  final String? ruleCode;

  const SodViolationCard({
    super.key,
    required this.title,
    required this.message,
    this.ruleCode,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFECACA), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.gavel_rounded,
                color: Color(0xFFDC2626),
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFFB91C1C),
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
              if (ruleCode != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    ruleCode!,
                    style: const TextStyle(
                      color: Color(0xFF991B1B),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              color: Color(0xFF7F1D1D),
              fontSize: 12,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
