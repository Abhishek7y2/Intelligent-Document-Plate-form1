import 'package:flutter/material.dart';
import '../../domain/entities/review_workbench.dart';

/// Touch-friendly card displaying invoice math reconciliation (Net + Tax = Total).
/// Clearly highlights discrepancies and signals whether an override reason is mandatory for approval.
class MathReconciliationCard extends StatelessWidget {
  final InvoiceReconciliation reconciliation;

  const MathReconciliationCard({
    super.key,
    required this.reconciliation,
  });

  @override
  Widget build(BuildContext context) {
    final isMatch = reconciliation.mathValid;
    final currency = reconciliation.currency;
    final statusColor = isMatch ? const Color(0xFF10B981) : const Color(0xFFEF4444);
    final statusBgColor = isMatch ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2);
    final borderColor = isMatch ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: statusBgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isMatch ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
                color: statusColor,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isMatch ? 'Math Reconciled (Verified)' : 'Invoice Total Mismatch',
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: isMatch ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isMatch ? 'BALANCED' : 'DELTA: $currency${reconciliation.discrepancy.abs().toStringAsFixed(2)}',
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildMathItem(context, 'Net Amount', '$currency${reconciliation.netAmount.toStringAsFixed(2)}'),
              const Text('+', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
              _buildMathItem(context, 'Tax Amount', '$currency${reconciliation.taxAmount.toStringAsFixed(2)}'),
              const Text('=', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
              _buildMathItem(context, 'Calculated', '$currency${reconciliation.calculatedTotal.toStringAsFixed(2)}'),
              const Text('vs', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
              _buildMathItem(
                context,
                'Stated Total',
                '$currency${reconciliation.totalAmount.toStringAsFixed(2)}',
                isHighlighted: !isMatch,
              ),
            ],
          ),
          if (!isMatch) ...[
            const SizedBox(height: 8),
            const Text(
              'Backend requires an explicit override reason to approve this document with a math discrepancy.',
              style: TextStyle(
                color: Color(0xFF991B1B),
                fontSize: 11,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMathItem(BuildContext context, String label, String value, {bool isHighlighted = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey[700],
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: isHighlighted ? const Color(0xFFDC2626) : Colors.black87,
          ),
        ),
      ],
    );
  }
}
