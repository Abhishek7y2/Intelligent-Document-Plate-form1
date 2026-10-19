import 'package:equatable/equatable.dart';

abstract class VersionCompareEvent extends Equatable {
  const VersionCompareEvent();

  @override
  List<Object?> get props => [];
}

class LoadDocumentVersions extends VersionCompareEvent {
  final String documentId;

  const LoadDocumentVersions(this.documentId);

  @override
  List<Object?> get props => [documentId];
}

class ExecuteVersionComparison extends VersionCompareEvent {
  final String docId1;
  final String docId2;

  const ExecuteVersionComparison({
    required this.docId1,
    required this.docId2,
  });

  @override
  List<Object?> get props => [docId1, docId2];
}

class LoadExistingComparisonById extends VersionCompareEvent {
  final String comparisonId;

  const LoadExistingComparisonById(this.comparisonId);

  @override
  List<Object?> get props => [comparisonId];
}
