import 'package:equatable/equatable.dart';

enum DiffChunkType {
  normal,
  added,
  removed;

  static DiffChunkType fromString(String val) {
    switch (val.toLowerCase()) {
      case 'added':
        return DiffChunkType.added;
      case 'removed':
        return DiffChunkType.removed;
      default:
        return DiffChunkType.normal;
    }
  }
}

class DiffChunk extends Equatable {
  final String text;
  final DiffChunkType type;

  const DiffChunk({
    required this.text,
    required this.type,
  });

  @override
  List<Object?> get props => [text, type];
}

enum RiskLevel {
  high,
  medium,
  low,
  none;

  static RiskLevel fromString(String val) {
    switch (val.toLowerCase()) {
      case 'high':
        return RiskLevel.high;
      case 'medium':
        return RiskLevel.medium;
      case 'low':
        return RiskLevel.low;
      default:
        return RiskLevel.none;
    }
  }
}

class ClauseDiff extends Equatable {
  final String id;
  final String sectionNumber;
  final String title;
  final String category;
  final String changeType; // 'added' | 'removed' | 'modified' | 'unchanged'
  final String version1Text;
  final String version2Text;
  final String beforeSummary;
  final String afterSummary;
  final String plainEnglishImpact;
  final String legalRecommendation;
  final String? fallbackClause;
  final String pageCitationV1;
  final String pageCitationV2;
  final RiskLevel riskImpact;
  final String status;
  final List<DiffChunk> v1Chunks;
  final List<DiffChunk> v2Chunks;
  final List<DiffChunk> unifiedChunks;

  const ClauseDiff({
    required this.id,
    required this.sectionNumber,
    required this.title,
    required this.category,
    required this.changeType,
    required this.version1Text,
    required this.version2Text,
    required this.beforeSummary,
    required this.afterSummary,
    required this.plainEnglishImpact,
    required this.legalRecommendation,
    this.fallbackClause,
    required this.pageCitationV1,
    required this.pageCitationV2,
    required this.riskImpact,
    required this.status,
    required this.v1Chunks,
    required this.v2Chunks,
    required this.unifiedChunks,
  });

  @override
  List<Object?> get props => [
        id,
        sectionNumber,
        title,
        category,
        changeType,
        version1Text,
        version2Text,
        beforeSummary,
        afterSummary,
        plainEnglishImpact,
        legalRecommendation,
        fallbackClause,
        pageCitationV1,
        pageCitationV2,
        riskImpact,
        status,
        v1Chunks,
        v2Chunks,
        unifiedChunks,
      ];
}

class FieldDiff extends Equatable {
  final String fieldKey;
  final String label;
  final String v1Value;
  final String v2Value;
  final String status; // 'Added' | 'Removed' | 'Modified'
  final String? varianceImpact;
  final String plainMeaning;
  final String? pageCitationV1;
  final String? pageCitationV2;
  final bool? reviewed;

  const FieldDiff({
    required this.fieldKey,
    required this.label,
    required this.v1Value,
    required this.v2Value,
    required this.status,
    this.varianceImpact,
    required this.plainMeaning,
    this.pageCitationV1,
    this.pageCitationV2,
    this.reviewed,
  });

  @override
  List<Object?> get props => [
        fieldKey,
        label,
        v1Value,
        v2Value,
        status,
        varianceImpact,
        plainMeaning,
        pageCitationV1,
        pageCitationV2,
        reviewed,
      ];
}

class ComparisonSummary extends Equatable {
  final int totalClauses;
  final int addedCount;
  final int removedCount;
  final int modifiedCount;
  final int unchangedCount;
  final int highRiskCount;

  const ComparisonSummary({
    required this.totalClauses,
    required this.addedCount,
    required this.removedCount,
    required this.modifiedCount,
    required this.unchangedCount,
    required this.highRiskCount,
  });

  @override
  List<Object?> get props => [
        totalClauses,
        addedCount,
        removedCount,
        modifiedCount,
        unchangedCount,
        highRiskCount,
      ];
}

class ComparedDocMetadata extends Equatable {
  final String id;
  final String name;
  final String version;

  const ComparedDocMetadata({
    required this.id,
    required this.name,
    required this.version,
  });

  @override
  List<Object?> get props => [id, name, version];
}

class DocumentComparisonResult extends Equatable {
  final String comparisonId;
  final String tenantId;
  final ComparedDocMetadata document1;
  final ComparedDocMetadata document2;
  final ComparisonSummary summary;
  final List<ClauseDiff> clauses;
  final List<FieldDiff> fieldDiffs;
  final DateTime createdAt;

  const DocumentComparisonResult({
    required this.comparisonId,
    required this.tenantId,
    required this.document1,
    required this.document2,
    required this.summary,
    required this.clauses,
    required this.fieldDiffs,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [
        comparisonId,
        tenantId,
        document1,
        document2,
        summary,
        clauses,
        fieldDiffs,
        createdAt,
      ];
}
