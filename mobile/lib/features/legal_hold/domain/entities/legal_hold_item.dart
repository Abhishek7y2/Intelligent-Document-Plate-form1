import 'package:equatable/equatable.dart';

enum LegalHoldStatus {
  active,
  released;

  String get displayName => this == LegalHoldStatus.active ? 'ACTIVE HOLD' : 'RELEASED';

  static LegalHoldStatus fromString(String status) {
    return status.toUpperCase() == 'RELEASED'
        ? LegalHoldStatus.released
        : LegalHoldStatus.active;
  }
}

class LegalHoldItem extends Equatable {
  final String id;
  final String tenantId;
  final String matterName;
  final String matterNumber;
  final String reason;
  final List<String> scopeDocumentIds;
  final String? scopeDocumentType;
  final LegalHoldStatus status;
  final String placedBy;
  final DateTime placedAt;
  final String? releasedBy;
  final DateTime? releasedAt;
  final String? releaseReason;
  final DateTime createdAt;
  final DateTime updatedAt;

  const LegalHoldItem({
    required this.id,
    required this.tenantId,
    required this.matterName,
    required this.matterNumber,
    required this.reason,
    required this.scopeDocumentIds,
    this.scopeDocumentType,
    required this.status,
    required this.placedBy,
    required this.placedAt,
    this.releasedBy,
    this.releasedAt,
    this.releaseReason,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isActive => status == LegalHoldStatus.active;

  LegalHoldItem copyWith({
    String? id,
    String? tenantId,
    String? matterName,
    String? matterNumber,
    String? reason,
    List<String>? scopeDocumentIds,
    String? scopeDocumentType,
    LegalHoldStatus? status,
    String? placedBy,
    DateTime? placedAt,
    String? releasedBy,
    DateTime? releasedAt,
    String? releaseReason,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return LegalHoldItem(
      id: id ?? this.id,
      tenantId: tenantId ?? this.tenantId,
      matterName: matterName ?? this.matterName,
      matterNumber: matterNumber ?? this.matterNumber,
      reason: reason ?? this.reason,
      scopeDocumentIds: scopeDocumentIds ?? this.scopeDocumentIds,
      scopeDocumentType: scopeDocumentType ?? this.scopeDocumentType,
      status: status ?? this.status,
      placedBy: placedBy ?? this.placedBy,
      placedAt: placedAt ?? this.placedAt,
      releasedBy: releasedBy ?? this.releasedBy,
      releasedAt: releasedAt ?? this.releasedAt,
      releaseReason: releaseReason ?? this.releaseReason,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        tenantId,
        matterName,
        matterNumber,
        reason,
        scopeDocumentIds,
        scopeDocumentType,
        status,
        placedBy,
        placedAt,
        releasedBy,
        releasedAt,
        releaseReason,
        createdAt,
        updatedAt,
      ];
}
