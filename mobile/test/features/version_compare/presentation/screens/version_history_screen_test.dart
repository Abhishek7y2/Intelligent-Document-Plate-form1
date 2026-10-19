import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/version_compare/domain/entities/document_version.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_bloc.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_event.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/bloc/version_compare_state.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/screens/version_history_screen.dart';

class MockVersionCompareBloc
    extends MockBloc<VersionCompareEvent, VersionCompareState>
    implements VersionCompareBloc {}

void main() {
  late MockVersionCompareBloc mockBloc;

  final sampleVersions = [
    DocumentVersionItem(
      id: 'v-2',
      documentId: 'doc-101',
      tenantId: 'tenant-1',
      versionNo: 2,
      storageKey: 'tenants/tenant-1/docs/doc-101-v2.pdf',
      sha256Hash: 'hash-v2-abc-def',
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
      sha256Hash: 'hash-v1-abc-def',
      isCurrent: false,
      createdBy: 'uploader@acme.com',
      createdAt: DateTime.parse('2026-10-16T10:00:00Z'),
    ),
  ];

  setUp(() {
    mockBloc = MockVersionCompareBloc();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: VersionHistoryScreen(
        documentId: 'doc-101',
        bloc: mockBloc,
      ),
    );
  }

  group('VersionHistoryScreen Widget Tests', () {
    testWidgets('renders loading state when state is VersionCompareLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(VersionCompareLoading());

      await tester.pumpWidget(buildTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('renders empty state when versions list is empty', (tester) async {
      when(() => mockBloc.state).thenReturn(const DocumentVersionsLoaded(
        documentId: 'doc-101',
        versions: [],
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('No Previous Versions'), findsOneWidget);
    });

    testWidgets('renders version items and enables compare action on 2 selections', (tester) async {
      when(() => mockBloc.state).thenReturn(DocumentVersionsLoaded(
        documentId: 'doc-101',
        versions: sampleVersions,
      ));

      await tester.pumpWidget(buildTestWidget());

      expect(find.text('v2.0'), findsOneWidget);
      expect(find.text('CURRENT'), findsOneWidget);
      expect(find.text('v1.0'), findsOneWidget);

      // Select both versions
      await tester.tap(find.text('v2.0'));
      await tester.pump();
      await tester.tap(find.text('v1.0'));
      await tester.pump();

      expect(find.widgetWithText(ElevatedButton, 'Compare Selected Versions'), findsOneWidget);
    });
  });
}
