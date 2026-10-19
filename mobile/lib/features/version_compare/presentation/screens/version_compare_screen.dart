import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../domain/entities/document_comparison.dart';
import '../bloc/version_compare_bloc.dart';
import '../bloc/version_compare_event.dart';
import '../bloc/version_compare_state.dart';
import '../widgets/clause_diff_card.dart';
import '../widgets/field_diff_table.dart';

class VersionCompareScreen extends StatelessWidget {
  final String docId1;
  final String docId2;
  final String? comparisonId;
  final VersionCompareBloc? bloc;

  const VersionCompareScreen({
    super.key,
    required this.docId1,
    required this.docId2,
    this.comparisonId,
    this.bloc,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<VersionCompareBloc>.value(
        value: bloc!,
        child: _VersionCompareView(
          docId1: docId1,
          docId2: docId2,
          comparisonId: comparisonId,
        ),
      );
    }
    return BlocProvider<VersionCompareBloc>(
      create: (_) {
        final b = sl<VersionCompareBloc>();
        if (comparisonId != null && comparisonId!.isNotEmpty) {
          b.add(LoadExistingComparisonById(comparisonId!));
        } else {
          b.add(ExecuteVersionComparison(docId1: docId1, docId2: docId2));
        }
        return b;
      },
      child: _VersionCompareView(
        docId1: docId1,
        docId2: docId2,
        comparisonId: comparisonId,
      ),
    );
  }
}

class _VersionCompareView extends StatelessWidget {
  final String docId1;
  final String docId2;
  final String? comparisonId;

  const _VersionCompareView({
    required this.docId1,
    required this.docId2,
    this.comparisonId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Version Comparison Studio'),
      ),
      body: BlocBuilder<VersionCompareBloc, VersionCompareState>(
        builder: (context, state) {
          if (state is VersionCompareLoading) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Analyzing document versions & computing diffs...'),
                ],
              ),
            );
          }

          if (state is VersionCompareError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(state.message, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        context.read<VersionCompareBloc>().add(
                              ExecuteVersionComparison(docId1: docId1, docId2: docId2),
                            );
                      },
                      child: const Text('Retry Comparison'),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is VersionComparisonSuccess) {
            return _buildComparisonStudio(context, state.comparison);
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildComparisonStudio(BuildContext context, DocumentComparisonResult comparison) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          // Top Comparison Header
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF0F172A), // Slate 900
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Baseline Version', style: TextStyle(color: Colors.white60, fontSize: 10)),
                          Text(
                            '${comparison.document1.name} (${comparison.document1.version})',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8.0),
                      child: Icon(Icons.compare_arrows_rounded, color: Colors.white70),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('Compared Version', style: TextStyle(color: Colors.white60, fontSize: 10)),
                          Text(
                            '${comparison.document2.name} (${comparison.document2.version})',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // KPI Metric Summary Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildMetricPill('High Risk', '${comparison.summary.highRiskCount}', const Color(0xFFEF4444)),
                    _buildMetricPill('Modified', '${comparison.summary.modifiedCount}', const Color(0xFFF59E0B)),
                    _buildMetricPill('Added', '${comparison.summary.addedCount}', const Color(0xFF10B981)),
                    _buildMetricPill('Removed', '${comparison.summary.removedCount}', const Color(0xFFEF4444)),
                    _buildMetricPill('Unchanged', '${comparison.summary.unchangedCount}', Colors.grey),
                  ],
                ),
              ],
            ),
          ),

          // Tabs
          Container(
            color: Colors.white,
            child: TabBar(
              labelColor: const Color(0xFF4F46E5),
              unselectedLabelColor: Colors.grey[600],
              indicatorColor: const Color(0xFF4F46E5),
              tabs: [
                Tab(text: 'Clause Diffs (${comparison.clauses.length})'),
                Tab(text: 'Field Diffs (${comparison.fieldDiffs.length})'),
              ],
            ),
          ),

          // Tab Views
          Expanded(
            child: TabBarView(
              children: [
                // Clauses Tab
                comparison.clauses.isEmpty
                    ? const Center(
                        child: Text(
                          'No clause differences detected between versions.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        itemCount: comparison.clauses.length,
                        itemBuilder: (context, index) {
                          return ClauseDiffCard(clause: comparison.clauses[index]);
                        },
                      ),

                // Fields Tab
                FieldDiffTable(fieldDiffs: comparison.fieldDiffs),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricPill(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 9),
          ),
        ],
      ),
    );
  }
}
