import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/version_compare/domain/entities/document_comparison.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_bloc.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_event.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_state.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/screens/version_compare_screen.dart';

class MockVersionCompareBloc
    extends MockBloc<VersionCompareEvent, VersionCompareState>
    implements VersionCompareBloc {}

void main() {
  late MockVersionCompareBloc mockBloc;

  final sampleComparison = DocumentComparisonResult(
    comparisonId: 'cmp-999',
    tenantId: 'tenant-test',
    document1: const ComparedDocMetadata(id: 'doc-1', name: 'Master Agreement', version: 'v1.0'),
    document2: const ComparedDocMetadata(id: 'doc-2', name: 'Master Agreement', version: 'v2.0'),
    summary: const ComparisonSummary(
      totalClauses: 10,
      addedCount: 2,
      removedCount: 1,
      modifiedCount: 3,
      unchangedCount: 4,
      highRiskCount: 2,
    ),
    clauses: const [
      ClauseDiff(
        id: 'cls-1',
        sectionNumber: '4.2',
        title: 'Indemnification & Liability',
        category: 'legal',
        changeType: 'modified',
        version1Text: 'Standard liability applies.',
        version2Text: 'Unlimited liability applies for confidentiality breaches.',
        beforeSummary: 'Standard cap',
        afterSummary: 'Unlimited breach cap',
        plainEnglishImpact: 'Significantly expands organization exposure to unlimited damages.',
        legalRecommendation: 'Seek mutual cap at 2x annual contract value.',
        pageCitationV1: 'p.4',
        pageCitationV2: 'p.5',
        riskImpact: RiskLevel.high,
        status: 'pending',
        v1Chunks: [],
        v2Chunks: [],
        unifiedChunks: [
          DiffChunk(text: 'Standard liability ', type: DiffChunkType.removed),
          DiffChunk(text: 'Unlimited liability ', type: DiffChunkType.added),
          DiffChunk(text: 'applies.', type: DiffChunkType.normal),
        ],
      ),
    ],
    fieldDiffs: const [
      FieldDiff(
        fieldKey: 'net_amount',
        label: 'Net Amount',
        v1Value: '\$10,000',
        v2Value: '\$12,500',
        status: 'Modified',
        plainMeaning: 'Price adjustment per renewal schedule',
      ),
    ],
    createdAt: DateTime.parse('2026-10-17T12:00:00Z'),
  );

  setUp(() {
    mockBloc = MockVersionCompareBloc();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: VersionCompareScreen(
        docId1: 'doc-1',
        docId2: 'doc-2',
        bloc: mockBloc,
      ),
    );
  }

  group('VersionCompareScreen Widget Tests', () {
    testWidgets('renders loading indicator when state is VersionCompareLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(VersionCompareLoading());

      await tester.pumpWidget(buildTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.textContaining('Analyzing document versions'), findsOneWidget);
    });

    testWidgets('renders Comparison Studio with metadata, risk summary, and clause cards', (tester) async {
      when(() => mockBloc.state).thenReturn(VersionComparisonSuccess(sampleComparison));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('Version Comparison Studio'), findsOneWidget);
      expect(find.text('Master Agreement (v1.0)'), findsOneWidget);
      expect(find.text('Master Agreement (v2.0)'), findsOneWidget);

      // KPI Metric pills
      expect(find.text('High Risk'), findsOneWidget);
      expect(find.text('Modified'), findsOneWidget);
      expect(find.text('Added'), findsOneWidget);

      // Clause Diffs
      expect(find.text('Section 4.2: Indemnification & Liability'), findsOneWidget);
      expect(find.text('HIGH RISK'), findsOneWidget);
      expect(find.textContaining('Significantly expands organization exposure'), findsOneWidget);
    });
  });
}
