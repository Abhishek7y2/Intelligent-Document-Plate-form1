import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/qa/domain/entities/qa_entity.dart';
import 'package:docunexa_mobile/features/qa/domain/repositories/qa_repository.dart';
import 'package:docunexa_mobile/features/qa/presentation/bloc/qa_bloc.dart';
import 'package:docunexa_mobile/features/qa/presentation/bloc/qa_event.dart';
import 'package:docunexa_mobile/features/qa/presentation/bloc/qa_state.dart';

class MockQaRepository extends Mock implements QaRepository {}

void main() {
  late MockQaRepository mockRepository;
  late QaBloc bloc;

  final sampleAnswer = QaAnswerResult(
    traceId: 'trace-123',
    question: 'What is the payment term?',
    answer: 'The payment term is Net 30 days from invoice receipt.',
    status: QaStatus.answered,
    confidence: 0.95,
    citations: const [
      QaCitation(
        citationId: 'cit-1',
        documentId: 'doc-99',
        documentTitle: 'Master Services Agreement',
        sourceVersion: 'v1.0',
        pageNumber: 4,
        section: 'Section 4.1 Payment Terms',
        spanId: 'span-44',
        snippet: 'Invoices shall be paid within thirty (30) days of receipt.',
        isAuthorized: true,
      ),
    ],
    modelName: 'DocuNexa-RAG',
    durationMs: 340,
  );

  final sampleVerification = const CitationVerification(
    citationId: 'cit-1',
    documentId: 'doc-99',
    documentTitle: 'Master Services Agreement',
    sourceVersion: 'v1.0',
    pageNumber: 4,
    isAuthorized: true,
  );

  final sampleDocs = const [
    QaAvailableDoc(
      documentId: 'doc-99',
      title: 'Master Services Agreement',
      documentType: 'CONTRACT',
      status: 'PROCESSED',
      version: 'v1.0',
    ),
  ];

  setUp(() {
    mockRepository = MockQaRepository();
    bloc = QaBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('QaBloc Tests', () {
    test('initial state is default QaState', () {
      expect(bloc.state, const QaState());
    });

    blocTest<QaBloc, QaState>(
      'emits available documents when QaLoadAvailableDocuments succeeds',
      build: () {
        when(() => mockRepository.getAvailableDocuments())
            .thenAnswer((_) async => sampleDocs);
        return bloc;
      },
      act: (b) => b.add(const QaLoadAvailableDocuments()),
      expect: () => [
        const QaState(isLoadingDocuments: true),
        QaState(availableDocuments: sampleDocs, isLoadingDocuments: false),
      ],
    );

    blocTest<QaBloc, QaState>(
      'selects document scope on QaSelectDocumentScope',
      build: () => bloc,
      act: (b) => b.add(const QaSelectDocumentScope(
        documentId: 'doc-99',
        documentTitle: 'Master Services Agreement',
      )),
      expect: () => [
        const QaState(
          selectedDocumentId: 'doc-99',
          selectedDocumentTitle: 'Master Services Agreement',
        ),
      ],
    );

    blocTest<QaBloc, QaState>(
      'emits completed turn with answer when QaAskQuestion succeeds',
      build: () {
        when(() => mockRepository.askQuestion(
              question: 'What is the payment term?',
              documentId: null,
            )).thenAnswer((_) async => sampleAnswer);
        return bloc;
      },
      act: (b) => b.add(const QaAskQuestion('What is the payment term?')),
      expect: () => [
        const QaState(
          conversation: [
            QaConversationTurn(
              question: 'What is the payment term?',
              isLoading: true,
            ),
          ],
          isAskingQuestion: true,
        ),
        QaState(
          conversation: [
            QaConversationTurn(
              question: 'What is the payment term?',
              answer: sampleAnswer,
              isLoading: false,
            ),
          ],
          isAskingQuestion: false,
        ),
      ],
    );

    blocTest<QaBloc, QaState>(
      'verifies citation on QaVerifyCitation',
      build: () {
        when(() => mockRepository.verifyCitation(
              documentId: 'doc-99',
              citationId: 'cit-1',
            )).thenAnswer((_) async => sampleVerification);
        return bloc;
      },
      act: (b) => b.add(const QaVerifyCitation(
        documentId: 'doc-99',
        citationId: 'cit-1',
      )),
      expect: () => [
        const QaState(isVerifyingCitation: true),
        QaState(
          isVerifyingCitation: false,
          lastVerifiedCitation: sampleVerification,
        ),
      ],
    );

    blocTest<QaBloc, QaState>(
      'updates feedback on QaSubmitFeedbackEvent',
      seed: () => QaState(
        conversation: [
          QaConversationTurn(
            question: 'What is the payment term?',
            answer: sampleAnswer,
          ),
        ],
      ),
      build: () {
        when(() => mockRepository.submitFeedback(
              traceId: 'trace-123',
              feedback: 'HELPFUL',
            )).thenAnswer((_) async => true);
        return bloc;
      },
      act: (b) => b.add(const QaSubmitFeedbackEvent(
        traceId: 'trace-123',
        feedback: 'HELPFUL',
      )),
      expect: () => [
        QaState(
          conversation: [
            QaConversationTurn(
              question: 'What is the payment term?',
              answer: sampleAnswer,
              feedbackGiven: 'HELPFUL',
            ),
          ],
        ),
      ],
    );
  });
}
