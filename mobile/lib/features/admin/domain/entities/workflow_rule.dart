import 'package:equatable/equatable.dart';

class WorkflowRule extends Equatable {
  final String id;
  final String documentType;
  final String policyType;
  final String name;
  final String description;
  final String status;
  final String version;
  final Map<String, dynamic> rules;
  final DateTime updatedAt;

  const WorkflowRule({
    required this.id,
    required this.documentType,
    required this.policyType,
    required this.name,
    required this.description,
    required this.status,
    required this.version,
    required this.rules,
    required this.updatedAt,
  });

  bool get isActive => status.toUpperCase() == 'ACTIVE' || status.toUpperCase() == 'PUBLISHED';

  @override
  List<Object?> get props => [
        id,
        documentType,
        policyType,
        name,
        description,
        status,
        version,
        rules,
        updatedAt,
      ];
}
