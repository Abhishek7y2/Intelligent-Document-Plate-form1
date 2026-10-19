import 'package:equatable/equatable.dart';

class AdminTelemetry extends Equatable {
  final int totalDocuments;
  final int processedToday;
  final int activeReviewTasks;
  final int pendingApprovals;
  final double averageConfidence;
  final double straightThroughProcessingRate;
  final int deadLetterQueueDepth;
  final String systemHealth;
  final DateTime lastRefreshed;

  const AdminTelemetry({
    required this.totalDocuments,
    required this.processedToday,
    required this.activeReviewTasks,
    required this.pendingApprovals,
    required this.averageConfidence,
    required this.straightThroughProcessingRate,
    required this.deadLetterQueueDepth,
    required this.systemHealth,
    required this.lastRefreshed,
  });

  bool get isHealthy => systemHealth.toUpperCase() == 'UP' || systemHealth.toUpperCase() == 'HEALTHY';

  @override
  List<Object?> get props => [
        totalDocuments,
        processedToday,
        activeReviewTasks,
        pendingApprovals,
        averageConfidence,
        straightThroughProcessingRate,
        deadLetterQueueDepth,
        systemHealth,
        lastRefreshed,
      ];
}
