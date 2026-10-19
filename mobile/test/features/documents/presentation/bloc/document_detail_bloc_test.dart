import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/documents/domain/entities/document.dart';
import 'package:docunexa_mobile/features/documents/domain/repositories/document_repository.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_detail_bloc.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_detail_event.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_detail_state.dart';

class MockDocumentRepository extends Mock implements DocumentRepository {}

void main() {
  late MockDocumentRepository mockDocumentRepository;

  final sampleDetail = DocumentDetail(
    id: 'DOC-501',
    tenantId: 'TNT-CORP-01',
    fileName: 'Global_Supply_Contract.pdf',
    docType: 'CONTRACT',
    status: 'NEEDS_REVIEW',
    stage: 'VALIDATION',
    confidence: 0.88,
    slaStatus: 'COMPLIANT',
    source: 'SFTP',
    pageCount: 8,
    size: '2.4 MB',
    fileSizeBytes: 2516582,
    mimeType: 'application/pdf',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedAt: DateTime.parse('2026-10-15T08:30:00Z'),
  );

  setUp(() {
    mockDocumentRepository = MockDocumentRepository();
  });

  group('DocumentDetailBloc Tests', () {
    test('initial state is DocumentDetailInitial', () {
      final bloc = DocumentDetailBloc(documentRepository: mockDocumentRepository);
      expect(bloc.state, const DocumentDetailInitial());
    });

    blocTest<DocumentDetailBloc, DocumentDetailState>(
      'emits [DocumentDetailLoading, DocumentDetailLoaded] when document exists and user is authorized',
      build: () {
        when(() => mockDocumentRepository.getDocumentDetail('DOC-501'))
            .thenAnswer((_) async => sampleDetail);
        return DocumentDetailBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(const DocumentDetailFetchRequested('DOC-501')),
      expect: () => [
        const DocumentDetailLoading(),
        DocumentDetailLoaded(sampleDetail),
      ],
      verify: (_) {
        verify(() => mockDocumentRepository.getDocumentDetail('DOC-501')).called(1);
      },
    );

    blocTest<DocumentDetailBloc, DocumentDetailState>(
      'emits [DocumentDetailLoading, DocumentDetailError] when document is not found (404)',
      build: () {
        when(() => mockDocumentRepository.getDocumentDetail('DOC-UNKNOWN')).thenThrow(
          const ApiException(
            message: 'Document record not found',
            statusCode: 404,
            correlationId: 'req-err-404',
          ),
        );
        return DocumentDetailBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(const DocumentDetailFetchRequested('DOC-UNKNOWN')),
      expect: () => [
        const DocumentDetailLoading(),
        const DocumentDetailError(
          message: 'Document record not found',
          statusCode: 404,
          correlationId: 'req-err-404',
        ),
      ],
    );

    blocTest<DocumentDetailBloc, DocumentDetailState>(
      'emits [DocumentDetailLoading, DocumentDetailError] when unauthorized (403)',
      build: () {
        when(() => mockDocumentRepository.getDocumentDetail('DOC-CROSS-TENANT')).thenThrow(
          const ApiException(
            message: 'Tenant access boundary violation',
            statusCode: 403,
            correlationId: 'req-err-403',
          ),
        );
        return DocumentDetailBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(const DocumentDetailFetchRequested('DOC-CROSS-TENANT')),
      expect: () => [
        const DocumentDetailLoading(),
        const DocumentDetailError(
          message: 'Tenant access boundary violation',
          statusCode: 403,
          correlationId: 'req-err-403',
        ),
      ],
    );
  });
}
