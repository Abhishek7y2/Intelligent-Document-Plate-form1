import '../entities/legal_hold_item.dart';

abstract class LegalHoldRepository {
  Future<List<LegalHoldItem>> getLegalHolds();

  Future<LegalHoldItem> placeLegalHold({
    required String matterName,
    required String matterNumber,
    required String reason,
    List<String> scopeDocumentIds = const [],
    String? scopeDocumentType,
  });

  Future<LegalHoldItem> releaseLegalHold({
    required String holdId,
    required String releaseReason,
  });
}
