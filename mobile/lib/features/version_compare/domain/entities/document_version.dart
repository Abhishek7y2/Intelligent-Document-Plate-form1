import 'package:equatable/equatable.dart';

class DocumentVersionItem extends Equatable {
  final String id;
  final String documentId;
  final String tenantId;
  final int versionNo;
  final String storageKey;
  final String sha256Hash;
  final bool isCurrent;
  final String? createdBy;
  final DateTime createdAt;

  const DocumentVersionItem({
    required this.id,
    required this.documentId,
    required this.tenantId,
    required this.versionNo,
    required this.storageKey,
    required this.sha256Hash,
    required this.isCurrent,
    this.createdBy,
    required this.createdAt,
  });

  String get versionLabel => 'v$versionNo.0';

  @override
  List<Object?> get props => [
        id,
        documentId,
        tenantId,
        versionNo,
        storageKey,
        sha256Hash,
        isCurrent,
        createdBy,
        createdAt,
      ];
}
