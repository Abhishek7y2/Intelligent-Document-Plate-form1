import 'package:equatable/equatable.dart';

class KpiCard extends Equatable {
  final String label;
  final dynamic value;
  final String delta;
  final bool isPositive;
  final String subtext;

  const KpiCard({
    required this.label,
    required this.value,
    this.delta = '0',
    this.isPositive = true,
    this.subtext = '',
  });

  @override
  List<Object?> get props => [label, value, delta, isPositive, subtext];
}

class DashboardSummary extends Equatable {
  final List<KpiCard> kpis;
  final double stpRatePercent;
  final int totalProcessed;
  final double complianceScorePercent;
  final int activeExceptions;
  final Map<String, int> statusDistribution;
  final String generatedAt;

  const DashboardSummary({
    required this.kpis,
    required this.stpRatePercent,
    required this.totalProcessed,
    required this.complianceScorePercent,
    required this.activeExceptions,
    this.statusDistribution = const {},
    required this.generatedAt,
  });

  @override
  List<Object?> get props => [
        kpis,
        stpRatePercent,
        totalProcessed,
        complianceScorePercent,
        activeExceptions,
        statusDistribution,
        generatedAt,
      ];
}
