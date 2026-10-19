import 'package:flutter/material.dart';
import '../../domain/entities/document_comparison.dart';
import 'diff_chunk_viewer.dart';

class ClauseDiffCard extends StatefulWidget {
  final ClauseDiff clause;

  const ClauseDiffCard({
    super.key,
    required this.clause,
  });

  @override
  State<ClauseDiffCard> createState() => _ClauseDiffCardState();
}

class _ClauseDiffCardState extends State<ClauseDiffCard> {
  bool _isExpanded = false;

  Color _getRiskColor(RiskLevel level) {
    switch (level) {
      case RiskLevel.high:
        return const Color(0xFFEF4444);
      case RiskLevel.medium:
        return const Color(0xFFF59E0B);
      case RiskLevel.low:
        return const Color(0xFF3B82F6);
      case RiskLevel.none:
        return const Color(0xFF10B981);
    }
  }

  Color _getChangeTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'added':
        return const Color(0xFF10B981);
      case 'removed':
        return const Color(0xFFEF4444);
      case 'modified':
        return const Color(0xFFF59E0B);
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.clause;
    final riskColor = _getRiskColor(c.riskImpact);
    final changeColor = _getChangeTypeColor(c.changeType);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: c.riskImpact == RiskLevel.high
              ? const Color(0xFFFECACA)
              : Colors.grey[200]!,
          width: c.riskImpact == RiskLevel.high ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: changeColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              c.changeType.toUpperCase(),
                              style: TextStyle(
                                color: changeColor,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: riskColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${c.riskImpact.name.toUpperCase()} RISK',
                              style: TextStyle(
                                color: riskColor,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            c.category.toUpperCase(),
                            style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        c.sectionNumber.isNotEmpty
                            ? 'Section ${c.sectionNumber}: ${c.title}'
                            : c.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(_isExpanded ? Icons.expand_less : Icons.expand_more),
                  onPressed: () {
                    setState(() {
                      _isExpanded = !_isExpanded;
                    });
                  },
                ),
              ],
            ),
          ),

          // Plain English Impact
          if (c.plainEnglishImpact.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: Color(0xFF475569)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        c.plainEnglishImpact,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF334155), height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (_isExpanded) ...[
            const Divider(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Unified Text Diff (Additions in green, removals in red):',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: DiffChunkViewer(chunks: c.unifiedChunks),
                  ),
                  if (c.legalRecommendation.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Legal Recommendation: ${c.legalRecommendation}',
                      style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Color(0xFF64748B)),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    'Citations: V1 ${c.pageCitationV1} • V2 ${c.pageCitationV2}',
                    style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
