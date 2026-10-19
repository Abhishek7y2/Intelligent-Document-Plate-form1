import 'package:equatable/equatable.dart';

abstract class LegalHoldEvent extends Equatable {
  const LegalHoldEvent();

  @override
  List<Object?> get props => [];
}

class LegalHoldFetchRequested extends LegalHoldEvent {
  const LegalHoldFetchRequested();
}

class LegalHoldPlaceRequested extends LegalHoldEvent {
  final String matterName;
  final String matterNumber;
  final String reason;
  final List<String> scopeDocumentIds;
  final String? scopeDocumentType;

  const LegalHoldPlaceRequested({
    required this.matterName,
    required this.matterNumber,
    required this.reason,
    this.scopeDocumentIds = const [],
    this.scopeDocumentType,
  });

  @override
  List<Object?> get props => [
        matterName,
        matterNumber,
        reason,
        scopeDocumentIds,
        scopeDocumentType,
      ];
}

class LegalHoldReleaseRequested extends LegalHoldEvent {
  final String holdId;
  final String releaseReason;

  const LegalHoldReleaseRequested({
    required this.holdId,
    required this.releaseReason,
  });

  @override
  List<Object?> get props => [holdId, releaseReason];
}
