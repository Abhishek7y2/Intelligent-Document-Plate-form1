import 'package:equatable/equatable.dart';

enum QaStatus {
  answered,
  abstained,
  conflictDetected,
  insufficientEvidence,
  securityBlocked,
  error;

  String get displayName {
    switch (this) {
      case QaStatus.answered:
        return 'Grounded Answer';
      case QaStatus.abstained:
        return 'Abstained';
      case QaStatus.conflictDetected:
        return 'Conflict Detected';
      case QaStatus.insufficientEvidence:
        return 'Insufficient Evidence';
      case QaStatus.securityBlocked:
        return 'Security Blocked';
      case QaStatus.error:
        return 'Processing Error';
    }
  }

  static QaStatus fromString(String status) {
    switch (status.toUpperCase()) {
      case 'ANSWERED':
        return QaStatus.answered;
      case 'ABSTAINED':
        return QaStatus.abstained;
      case 'CONFLICT_DETECTED':
        return QaStatus.conflictDetected;
      case 'INSUFFICIENT_EVIDENCE':
        return QaStatus.insufficientEvidence;
      case 'SECURITY_BLOCKED':
        return QaStatus.securityBlocked;
      default:
        return QaStatus.error;
    }
  }
}

class QaCitation extends Equatable {
  final String citationId;
  final String documentId;
  final String documentTitle;
  final String sourceVersion;
  final int pageNumber;
  final String section;
  final String spanId;
  final String snippet;
  final bool isAuthorized;
  final bool isRestricted;
  final bool isSuperseded;
  final String? latestVersion;

  const QaCitation({
    required this.citationId,
    required this.documentId,
    required this.documentTitle,
    required this.sourceVersion,
    required this.pageNumber,
    required this.section,
    required this.spanId,
    required this.snippet,
    required this.isAuthorized,
    this.isRestricted = false,
    this.isSuperseded = false,
    this.latestVersion,
  });

  @override
  List<Object?> get props => [
        citationId,
        documentId,
        documentTitle,
        sourceVersion,
        pageNumber,
        section,
        spanId,
        snippet,
        isAuthorized,
        isRestricted,
        isSuperseded,
        latestVersion,
      ];
}

class QaConflict extends Equatable {
  final String clauseA;
  final String clauseB;
  final String sourceVersionA;
  final String sourceVersionB;
  final String description;

  const QaConflict({
    required this.clauseA,
    required this.clauseB,
    required this.sourceVersionA,
    required this.sourceVersionB,
    required this.description,
  });

  @override
  List<Object?> get props => [clauseA, clauseB, sourceVersionA, sourceVersionB, description];
}

class QaDocumentFreshness extends Equatable {
  final String documentId;
  final String documentName;
  final String usedVersion;
  final String latestVersion;
  final bool isSuperseded;
  final String? notice;

  const QaDocumentFreshness({
    required this.documentId,
    required this.documentName,
    required this.usedVersion,
    required this.latestVersion,
    required this.isSuperseded,
    this.notice,
  });

  @override
  List<Object?> get props => [documentId, documentName, usedVersion, latestVersion, isSuperseded, notice];
}

class QaAnswerResult extends Equatable {
  final String traceId;
  final String? sessionId;
  final String question;
  final String answer;
  final QaStatus status;
  final String? abstentionReason;
  final double confidence;
  final List<QaCitation> citations;
  final List<QaConflict> conflicts;
  final List<QaDocumentFreshness> documentFreshness;
  final String modelName;
  final int durationMs;

  const QaAnswerResult({
    required this.traceId,
    this.sessionId,
    required this.question,
    required this.answer,
    required this.status,
    this.abstentionReason,
    required this.confidence,
    required this.citations,
    this.conflicts = const [],
    this.documentFreshness = const [],
    required this.modelName,
    required this.durationMs,
  });

  @override
  List<Object?> get props => [
        traceId,
        sessionId,
        question,
        answer,
        status,
        abstentionReason,
        confidence,
        citations,
        conflicts,
        documentFreshness,
        modelName,
        durationMs,
      ];
}

class QaAvailableDoc extends Equatable {
  final String documentId;
  final String title;
  final String documentType;
  final String status;
  final String version;

  const QaAvailableDoc({
    required this.documentId,
    required this.title,
    required this.documentType,
    required this.status,
    required this.version,
  });

  @override
  List<Object?> get props => [documentId, title, documentType, status, version];
}

class CitationVerification extends Equatable {
  final String citationId;
  final String documentId;
  final String? documentTitle;
  final String sourceVersion;
  final int pageNumber;
  final String? spanId;
  final bool isAuthorized;
  final String? reason;
  final String? redirectUrl;

  const CitationVerification({
    required this.citationId,
    required this.documentId,
    this.documentTitle,
    required this.sourceVersion,
    required this.pageNumber,
    this.spanId,
    required this.isAuthorized,
    this.reason,
    this.redirectUrl,
  });

  @override
  List<Object?> get props => [
        citationId,
        documentId,
        documentTitle,
        sourceVersion,
        pageNumber,
        spanId,
        isAuthorized,
        reason,
        redirectUrl,
      ];
}
