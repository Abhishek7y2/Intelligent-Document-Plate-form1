import 'package:equatable/equatable.dart';

class ReviewTaskItem extends Equatable {
  final String id;
  final String docId;
  final String tenantId;
  final String documentTitle;
  final String assignee;
  final double slaHoursLeft;
  final String status;
  final String priority; // 'High', 'Medium', 'Low'
  final int confidence; // 0 - 100
  final int pages;
  final DateTime submittedAt;
  final String type;

  const ReviewTaskItem({
    required this.id,
    required this.docId,
    required this.tenantId,
    required this.documentTitle,
    required this.assignee,
    required this.slaHoursLeft,
    required this.status,
    required this.priority,
    required this.confidence,
    required this.pages,
    required this.submittedAt,
    required this.type,
  });

  bool get isHighPriority => priority.toLowerCase() == 'high';

  @override
  List<Object?> get props => [
        id,
        docId,
        tenantId,
        documentTitle,
        assignee,
        slaHoursLeft,
        status,
        priority,
        confidence,
        pages,
        submittedAt,
        type,
      ];
}
