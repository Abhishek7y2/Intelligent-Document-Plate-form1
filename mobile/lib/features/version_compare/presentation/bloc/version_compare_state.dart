import 'package:equatable/equatable.dart';
import '../../domain/entities/document_comparison.dart';
import '../../domain/entities/document_version.dart';

abstract class VersionCompareState extends Equatable {
  const VersionCompareState();

  @override
  List<Object?> get props => [];
}

class VersionCompareInitial extends VersionCompareState {}

class VersionCompareLoading extends VersionCompareState {}

class DocumentVersionsLoaded extends VersionCompareState {
  final String documentId;
  final List<DocumentVersionItem> versions;
  final String? selectedVersionId1;
  final String? selectedVersionId2;

  const DocumentVersionsLoaded({
    required this.documentId,
    required this.versions,
    this.selectedVersionId1,
    this.selectedVersionId2,
  });

  DocumentVersionsLoaded copyWith({
    String? documentId,
    List<DocumentVersionItem>? versions,
    String? selectedVersionId1,
    String? selectedVersionId2,
  }) {
    return DocumentVersionsLoaded(
      documentId: documentId ?? this.documentId,
      versions: versions ?? this.versions,
      selectedVersionId1: selectedVersionId1 ?? this.selectedVersionId1,
      selectedVersionId2: selectedVersionId2 ?? this.selectedVersionId2,
    );
  }

  @override
  List<Object?> get props => [documentId, versions, selectedVersionId1, selectedVersionId2];
}

class VersionComparisonSuccess extends VersionCompareState {
  final DocumentComparisonResult comparison;

  const VersionComparisonSuccess(this.comparison);

  @override
  List<Object?> get props => [comparison];
}

class VersionCompareError extends VersionCompareState {
  final String message;

  const VersionCompareError(this.message);

  @override
  List<Object?> get props => [message];
}
