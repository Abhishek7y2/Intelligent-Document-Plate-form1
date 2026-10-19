import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/theme/app_theme.dart';
import 'package:docunexa_mobile/features/documents/domain/entities/document.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_detail_bloc.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_detail_event.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_detail_state.dart';
import 'package:docunexa_mobile/features/documents/presentation/screens/document_detail_screen.dart';

class MockDocumentDetailBloc
    extends MockBloc<DocumentDetailEvent, DocumentDetailState>
    implements DocumentDetailBloc {}

void main() {
  late MockDocumentDetailBloc mockDocumentDetailBloc;

  final sampleDetail = DocumentDetail(
    id: 'DOC-501',
    tenantId: 'TNT-CORP-01',
    fileName: 'Enterprise_Master_Service_Agreement.pdf',
    docType: 'CONTRACT',
    status: 'NEEDS_REVIEW',
    stage: 'VALIDATION',
    confidence: 0.91,
    slaStatus: 'COMPLIANT',
    slaDeadline: '2026-10-18T18:00:00Z',
    source: 'SFTP_CONNECTOR',
    pageCount: 16,
    size: '3.8 MB',
    fileSizeBytes: 3984588,
    mimeType: 'application/pdf',
    sha256Hash: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
    uploadedAt: DateTime.parse('2026-10-16T14:20:00Z'),
  );

  setUp(() {
    mockDocumentDetailBloc = MockDocumentDetailBloc();
  });

  Widget createWidgetUnderTest() {
    return MaterialApp(
      theme: AppTheme.darkTheme,
      home: DocumentDetailScreen(
        documentId: 'DOC-501',
        bloc: mockDocumentDetailBloc,
      ),
    );
  }

  group('DocumentDetailScreen Widget Tests', () {
    testWidgets('renders loading state when DocumentDetailLoading', (tester) async {
      when(() => mockDocumentDetailBloc.state)
          .thenReturn(const DocumentDetailLoading());

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Document Details'), findsOneWidget);
      expect(find.text('Retrieving document record...'), findsOneWidget);
    });

    testWidgets('renders error view with retry action when DocumentDetailError', (tester) async {
      when(() => mockDocumentDetailBloc.state).thenReturn(
        const DocumentDetailError(
          message: 'Document record DOC-501 could not be found.',
          statusCode: 404,
          correlationId: 'req-det-err-404',
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Unable to load document'), findsOneWidget);
      expect(find.text('Document record DOC-501 could not be found.'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('renders document header, SLA card, metadata and SHA-256 hash when DocumentDetailLoaded', (tester) async {
      when(() => mockDocumentDetailBloc.state)
          .thenReturn(DocumentDetailLoaded(sampleDetail));

      await tester.pumpWidget(createWidgetUnderTest());

      // Header
      expect(find.text('Enterprise_Master_Service_Agreement.pdf'), findsOneWidget);
      expect(find.text('CONTRACT'), findsWidgets);
      expect(find.text('91%'), findsOneWidget); // Confidence score
      expect(find.text('NEEDS REVIEW'), findsWidgets);

      // SLA card
      expect(find.text('PROCESSING SLA STATUS'), findsOneWidget);
      expect(find.text('COMPLIANT'), findsWidgets);

      // Ingestion & File metadata
      expect(find.text('FILE & INGESTION METADATA'), findsOneWidget);
      expect(find.text('SFTP_CONNECTOR'), findsOneWidget);
      expect(find.text('3.8 MB (3,984,588 bytes)'), findsOneWidget);
      expect(find.text('16 pages'), findsOneWidget);
      expect(find.text('application/pdf'), findsOneWidget);

      // Cryptographic hash
      expect(find.text('CRYPTOGRAPHIC AUDIT TRAIL'), findsOneWidget);
      expect(
        find.text('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.copy_rounded), findsOneWidget);
    });
  });
}
