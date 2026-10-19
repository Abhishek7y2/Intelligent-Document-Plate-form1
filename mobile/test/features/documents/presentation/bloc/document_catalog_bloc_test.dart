import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/documents/domain/entities/document.dart';
import 'package:docunexa_mobile/features/documents/domain/repositories/document_repository.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_catalog_bloc.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_catalog_event.dart';
import 'package:docunexa_mobile/features/documents/presentation/bloc/document_catalog_state.dart';

class MockDocumentRepository extends Mock implements DocumentRepository {}

void main() {
  late MockDocumentRepository mockDocumentRepository;

  final sampleDoc1 = DocumentItem(
    id: 'DOC-101',
    tenantId: 'TNT-CORP-01',
    title: 'Vendor Contract 2026',
    docType: 'CONTRACT',
    status: 'NEEDS_REVIEW',
    confidence: 0.82,
    slaStatus: 'COMPLIANT',
    source: 'EMAIL',
    pages: 4,
    size: '1.4 MB',
    uploadedAt: DateTime.parse('2026-10-16T10:00:00Z'),
  );

  final sampleDoc2 = DocumentItem(
    id: 'DOC-102',
    tenantId: 'TNT-CORP-01',
    title: 'Logistics Invoice 88',
    docType: 'INVOICE',
    status: 'APPROVED',
    confidence: 0.95,
    slaStatus: 'COMPLIANT',
    source: 'PORTAL_UPLOAD',
    pages: 2,
    size: '800 KB',
    uploadedAt: DateTime.parse('2026-10-15T09:00:00Z'),
  );

  final page1Result = DocumentListResult(
    documents: [sampleDoc1],
    pagination: const DocumentPagination(
      totalItems: 2,
      page: 1,
      pageSize: 1,
      totalPages: 2,
    ),
  );

  final page2Result = DocumentListResult(
    documents: [sampleDoc2],
    pagination: const DocumentPagination(
      totalItems: 2,
      page: 2,
      pageSize: 1,
      totalPages: 2,
    ),
  );

  setUp(() {
    mockDocumentRepository = MockDocumentRepository();
  });

  group('DocumentCatalogBloc Tests', () {
    test('initial state is DocumentCatalogInitial', () {
      final bloc = DocumentCatalogBloc(documentRepository: mockDocumentRepository);
      expect(bloc.state, const DocumentCatalogInitial());
    });

    blocTest<DocumentCatalogBloc, DocumentCatalogState>(
      'emits [DocumentCatalogLoading, DocumentCatalogLoaded] on DocumentsFetchRequested',
      build: () {
        when(() => mockDocumentRepository.getDocuments(
              page: 1,
              pageSize: 20,
              filter: any(named: 'filter'),
            )).thenAnswer((_) async => page1Result);
        return DocumentCatalogBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(const DocumentsFetchRequested()),
      expect: () => [
        const DocumentCatalogLoading(),
        DocumentCatalogLoaded(
          documents: [sampleDoc1],
          pagination: page1Result.pagination,
          filter: const DocumentFilter(),
          hasReachedMax: false,
        ),
      ],
    );

    blocTest<DocumentCatalogBloc, DocumentCatalogState>(
      'ignores DocumentsFetchRequested if already in DocumentCatalogLoaded state (prevents duplicate fetch on tab switch)',
      seed: () => DocumentCatalogLoaded(
        documents: [sampleDoc1],
        pagination: page1Result.pagination,
      ),
      build: () => DocumentCatalogBloc(documentRepository: mockDocumentRepository),
      act: (bloc) => bloc.add(const DocumentsFetchRequested()),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockDocumentRepository.getDocuments(
              page: any(named: 'page'),
              pageSize: any(named: 'pageSize'),
              filter: any(named: 'filter'),
            ));
      },
    );

    blocTest<DocumentCatalogBloc, DocumentCatalogState>(
      'emits [isLoadingMore: true, then loaded with combined docs] on DocumentsNextPageRequested',
      seed: () => DocumentCatalogLoaded(
        documents: [sampleDoc1],
        pagination: const DocumentPagination(
          totalItems: 2,
          page: 1,
          pageSize: 1,
          totalPages: 2,
        ),
        hasReachedMax: false,
      ),
      build: () {
        when(() => mockDocumentRepository.getDocuments(
              page: 2,
              pageSize: 1,
              filter: any(named: 'filter'),
            )).thenAnswer((_) async => page2Result);
        return DocumentCatalogBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(const DocumentsNextPageRequested()),
      expect: () => [
        DocumentCatalogLoaded(
          documents: [sampleDoc1],
          pagination: const DocumentPagination(
            totalItems: 2,
            page: 1,
            pageSize: 1,
            totalPages: 2,
          ),
          hasReachedMax: false,
          isLoadingMore: true,
        ),
        DocumentCatalogLoaded(
          documents: [sampleDoc1, sampleDoc2],
          pagination: page2Result.pagination,
          hasReachedMax: true,
          isLoadingMore: false,
        ),
      ],
    );

    blocTest<DocumentCatalogBloc, DocumentCatalogState>(
      'ignores DocumentsNextPageRequested when already reached max page or currently loading more',
      seed: () => DocumentCatalogLoaded(
        documents: [sampleDoc1, sampleDoc2],
        pagination: page2Result.pagination,
        hasReachedMax: true,
        isLoadingMore: false,
      ),
      build: () => DocumentCatalogBloc(documentRepository: mockDocumentRepository),
      act: (bloc) => bloc.add(const DocumentsNextPageRequested()),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockDocumentRepository.getDocuments(
              page: any(named: 'page'),
              pageSize: any(named: 'pageSize'),
              filter: any(named: 'filter'),
            ));
      },
    );

    blocTest<DocumentCatalogBloc, DocumentCatalogState>(
      'emits [DocumentCatalogLoading, DocumentCatalogLoaded] with updated filter on DocumentFilterChanged',
      build: () {
        when(() => mockDocumentRepository.getDocuments(
              page: 1,
              pageSize: 20,
              filter: const DocumentFilter(status: 'NEEDS_REVIEW'),
            )).thenAnswer((_) async => page1Result);
        return DocumentCatalogBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(
        const DocumentFilterChanged(DocumentFilter(status: 'NEEDS_REVIEW')),
      ),
      expect: () => [
        const DocumentCatalogLoading(),
        DocumentCatalogLoaded(
          documents: [sampleDoc1],
          pagination: page1Result.pagination,
          filter: const DocumentFilter(status: 'NEEDS_REVIEW'),
          hasReachedMax: false,
        ),
      ],
    );

    blocTest<DocumentCatalogBloc, DocumentCatalogState>(
      'emits [DocumentCatalogError] on DocumentsFetchRequested when backend reports 403 authorization error',
      build: () {
        when(() => mockDocumentRepository.getDocuments(
              page: 1,
              pageSize: 20,
              filter: any(named: 'filter'),
            )).thenThrow(
          const ApiException(
            message: 'Tenant access boundary violation',
            statusCode: 403,
            correlationId: 'req-auth-fail-99',
          ),
        );
        return DocumentCatalogBloc(documentRepository: mockDocumentRepository);
      },
      act: (bloc) => bloc.add(const DocumentsFetchRequested()),
      expect: () => [
        const DocumentCatalogLoading(),
        const DocumentCatalogError(
          message: 'Tenant access boundary violation',
          correlationId: 'req-auth-fail-99',
        ),
      ],
    );
  });
}
