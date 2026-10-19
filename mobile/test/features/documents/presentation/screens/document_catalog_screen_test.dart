import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/theme/app_theme.dart';
import 'package:docunexa_mobile/features/documents/domain/entities/document.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_catalog_bloc.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_catalog_event.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_catalog_state.dart';
import 'package:docunexa_mobile/features/documents/presentation/screens/document_catalog_screen.dart';

class MockDocumentCatalogBloc
    extends MockBloc<DocumentCatalogEvent, DocumentCatalogState>
    implements DocumentCatalogBloc {}

void main() {
  late MockDocumentCatalogBloc mockDocumentCatalogBloc;

  final sampleDoc = DocumentItem(
    id: 'DOC-991',
    tenantId: 'TNT-CORP-01',
    title: 'Acme Invoice March 2026',
    docType: 'INVOICE',
    status: 'NEEDS_REVIEW',
    confidence: 0.84,
    slaStatus: 'COMPLIANT',
    source: 'EMAIL',
    pages: 3,
    size: '1.2 MB',
    uploadedAt: DateTime.parse('2026-10-16T12:00:00Z'),
  );

  setUp(() {
    mockDocumentCatalogBloc = MockDocumentCatalogBloc();
  });

  Widget createWidgetUnderTest() {
    return MaterialApp(
      theme: AppTheme.darkTheme,
      home: DocumentCatalogScreen(bloc: mockDocumentCatalogBloc),
    );
  }

  group('DocumentCatalogScreen Widget Tests', () {
    testWidgets('renders loading state when DocumentCatalogLoading', (tester) async {
      when(() => mockDocumentCatalogBloc.state)
          .thenReturn(const DocumentCatalogLoading());

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Document Catalog'), findsOneWidget);
      expect(find.text('Scanning document catalog...'), findsOneWidget);
    });

    testWidgets('renders empty state when DocumentCatalogLoaded with empty list', (tester) async {
      when(() => mockDocumentCatalogBloc.state).thenReturn(
        const DocumentCatalogLoaded(
          documents: [],
          pagination: DocumentPagination(
            totalItems: 0,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          ),
          filter: DocumentFilter(query: 'NonExistentDoc'),
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('No documents match criteria'), findsOneWidget);
      expect(
        find.text('Try broadening your search term or clearing active status and type filters.'),
        findsOneWidget,
      );
      expect(find.text('Reset Filters'), findsOneWidget);
    });

    testWidgets('renders error view with retry action when DocumentCatalogError', (tester) async {
      when(() => mockDocumentCatalogBloc.state).thenReturn(
        const DocumentCatalogError(
          message: 'Failed to communicate with documents API',
          correlationId: 'req-cat-err-01',
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Unable to retrieve documents'), findsOneWidget);
      expect(find.text('Failed to communicate with documents API'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('renders search field, filter chips, and document card when DocumentCatalogLoaded', (tester) async {
      when(() => mockDocumentCatalogBloc.state).thenReturn(
        DocumentCatalogLoaded(
          documents: [sampleDoc],
          pagination: const DocumentPagination(
            totalItems: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          ),
          filter: const DocumentFilter(),
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      // Search field
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Search by title, doc ID, or type...'), findsOneWidget);

      // Filter chips
      expect(find.text('ALL'), findsWidgets);
      expect(find.text('NEEDS REVIEW'), findsOneWidget);

      // Document card
      expect(find.text('Acme Invoice March 2026'), findsOneWidget);
      expect(find.text('DOC-991'), findsOneWidget);
      expect(find.text('INVOICE'), findsOneWidget);
      expect(find.text('84%'), findsOneWidget); // Confidence pill
      expect(find.text('1.2 MB'), findsOneWidget);
      expect(find.text('3 pages'), findsOneWidget);
    });
  });
}
