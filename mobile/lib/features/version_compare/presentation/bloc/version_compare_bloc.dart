import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/version_compare_repository.dart';
import 'version_compare_event.dart';
import 'version_compare_state.dart';

class VersionCompareBloc extends Bloc<VersionCompareEvent, VersionCompareState> {
  final VersionCompareRepository repository;

  VersionCompareBloc({required this.repository}) : super(VersionCompareInitial()) {
    on<LoadDocumentVersions>(_onLoadDocumentVersions);
    on<ExecuteVersionComparison>(_onExecuteVersionComparison);
    on<LoadExistingComparisonById>(_onLoadExistingComparisonById);
  }

  Future<void> _onLoadDocumentVersions(
    LoadDocumentVersions event,
    Emitter<VersionCompareState> emit,
  ) async {
    emit(VersionCompareLoading());
    try {
      final versions = await repository.listDocumentVersions(event.documentId);
      emit(DocumentVersionsLoaded(
        documentId: event.documentId,
        versions: versions,
      ));
    } catch (e) {
      emit(VersionCompareError('Failed to load version history: ${e.toString()}'));
    }
  }

  Future<void> _onExecuteVersionComparison(
    ExecuteVersionComparison event,
    Emitter<VersionCompareState> emit,
  ) async {
    emit(VersionCompareLoading());
    try {
      final comparison = await repository.compareDocuments(event.docId1, event.docId2);
      emit(VersionComparisonSuccess(comparison));
    } catch (e) {
      emit(VersionCompareError('Version comparison failed: ${e.toString()}'));
    }
  }

  Future<void> _onLoadExistingComparisonById(
    LoadExistingComparisonById event,
    Emitter<VersionCompareState> emit,
  ) async {
    emit(VersionCompareLoading());
    try {
      final comparison = await repository.getComparison(event.comparisonId);
      emit(VersionComparisonSuccess(comparison));
    } catch (e) {
      emit(VersionCompareError('Failed to load comparison record: ${e.toString()}'));
    }
  }
}
