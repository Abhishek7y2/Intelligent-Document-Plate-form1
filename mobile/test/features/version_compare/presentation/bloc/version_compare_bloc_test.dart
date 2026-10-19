import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/version_compare/domain/entities/document_comparison.dart';
import 'package:docunexa_mobile/features/version_compare/domain/entities/document_version.dart';
import 'package:docunexa_mobile/features/version_compare/domain/repositories/version_compare_repository.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_bloc.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_event.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_state.dart';

class MockVersionCompareRepository extends Mock implements VersionCompareRepository {}

void main() {
  late MockVersionCompareRepository mockRepository;
  late VersionCompareBloc bloc;

  final sampleVersions = [
    DocumentVersionItem(
      id: 'v-2',
      documentId: 'doc-101',
      tenantId: 'tenant-1',
      versionNo: 2,
      storageKey: 'tenants/tenant-1/docs/doc-101-v2.pdf',
      sha256Hash: 'hash-v2-abc',
      isCurrent: true,
      createdBy: 'editor@acme.com',
      createdAt: DateTime.parse('2026-10-17T10:00:00Z'),
    ),
    DocumentVersionItem(
      id: 'v-1',
      documentId: 'doc-101',
      tenantId: 'tenant-1',
      versionNo: 1,
      storageKey: 'tenants/tenant-1/docs/doc-101-v1.pdf',
      sha256Hash: 'hash-v1-abc',
      isCurrent: false,
      createdBy: 'uploader@acme.com',
      createdAt: DateTime.parse('2026-10-16T10:00:00Z'),
    ),
  ];

  final sampleComparison = DocumentComparisonResult(
    comparisonId: 'cmp-100',
    tenantId: 'tenant-1',
    document1: const ComparedDocMetadata(id: 'v-1', name: 'Invoice', version: 'v1.0'),
    document2: const ComparedDocMetadata(id: 'v-2', name: 'Invoice', version: 'v2.0'),
    summary: const ComparisonSummary(
      totalClauses: 5,
      addedCount: 1,
      removedCount: 0,
      modifiedCount: 2,
      unchangedCount: 2,
      highRiskCount: 1,
    ),
    clauses: const [],
    fieldDiffs: const [],
    createdAt: DateTime.parse('2026-10-17T11:00:00Z'),
  );

  setUp(() {
    mockRepository = MockVersionCompareRepository();
    bloc = VersionCompareBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('VersionCompareBloc Tests', () {
    test('initial state is VersionCompareInitial', () {
      expect(bloc.state, isA<VersionCompareInitial>());
    });

    blocTest<VersionCompareBloc, VersionCompareState>(
      'loads document versions on LoadDocumentVersions',
      build: () {
        when(() => mockRepository.listDocumentVersions('doc-101')).thenAnswer((_) async => sampleVersions);
        return bloc;
      },
      act: (b) => b.add(const LoadDocumentVersions('doc-101')),
      expect: () => [
        isA<VersionCompareLoading>(),
        isA<DocumentVersionsLoaded>()
            .having((s) => s.versions.length, 'versions.length', 2)
            .having((s) => s.documentId, 'documentId', 'doc-101'),
      ],
    );

    blocTest<VersionCompareBloc, VersionCompareState>(
      'executes version comparison and emits VersionComparisonSuccess',
      build: () {
        when(() => mockRepository.compareDocuments('v-1', 'v-2')).thenAnswer((_) async => sampleComparison);
        return bloc;
      },
      act: (b) => b.add(const ExecuteVersionComparison(docId1: 'v-1', docId2: 'v-2')),
      expect: () => [
        isA<VersionCompareLoading>(),
        isA<VersionComparisonSuccess>()
            .having((s) => s.comparison.comparisonId, 'comparisonId', 'cmp-100')
            .having((s) => s.comparison.summary.highRiskCount, 'highRiskCount', 1),
      ],
    );
  });
}
