import 'package:flutter/material.dart';
import '../../domain/entities/document_comparison.dart';

class FieldDiffTable extends StatelessWidget {
  final List<FieldDiff> fieldDiffs;

  const FieldDiffTable({
    super.key,
    required this.fieldDiffs,
  });

  @override
  Widget build(BuildContext context) {
    if (fieldDiffs.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text(
            'No extracted field differences detected.',
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: fieldDiffs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final f = fieldDiffs[index];
        final isModified = f.status.toLowerCase() == 'modified';
        final isAdded = f.status.toLowerCase() == 'added';
        final isRemoved = f.status.toLowerCase() == 'removed';

        final statusColor = isAdded
            ? const Color(0xFF10B981)
            : (isRemoved ? const Color(0xFFEF4444) : const Color(0xFFF59E0B));

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    f.label,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      f.status.toUpperCase(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Version 1 (Previous)',
                            style: TextStyle(fontSize: 10, color: Color(0xFF991B1B)),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            f.v1Value.isEmpty ? '(Empty)' : f.v1Value,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isModified ? FontWeight.bold : FontWeight.normal,
                              color: const Color(0xFF7F1D1D),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward, size: 14, color: Colors.grey),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Version 2 (Current)',
                            style: TextStyle(fontSize: 10, color: Color(0xFF065F46)),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            f.v2Value.isEmpty ? '(Empty)' : f.v2Value,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isModified ? FontWeight.bold : FontWeight.normal,
                              color: const Color(0xFF047857),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (f.varianceImpact != null && f.varianceImpact!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'Impact: ${f.varianceImpact}',
                  style: TextStyle(fontSize: 11, color: Colors.grey[700]),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
