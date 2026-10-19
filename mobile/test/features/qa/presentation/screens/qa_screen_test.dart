import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/qa/domain/entities/qa_entity.dart';
import 'package:docunexa_mobile/features/qa/presentation/bloc/qa_bloc.dart';
import 'package:docunexa_mobile/features/qa/presentation/bloc/qa_event.dart';
import 'package:docunexa_mobile/features/qa/presentation/bloc/qa_state.dart';
import 'package:docunexa_mobile/features/qa/presentation/screens/qa_screen.dart';

class MockQaBloc extends MockBloc<QaEvent, QaState> implements QaBloc {}

void main() {
  late MockQaBloc mockBloc;

  final sampleAnswer = QaAnswerResult(
    traceId: 'trace-100',
    question: 'What is the late fee policy?',
    answer: 'Late fee is 1.5% per month on overdue balances.',
    status: QaStatus.answered,
    confidence: 0.94,
    citations: const [
      QaCitation(
        citationId: 'cit-10',
        documentId: 'doc-1',
        documentTitle: 'Standard Terms and Conditions',
        sourceVersion: 'v2.0',
        pageNumber: 3,
        section: 'Payment Terms',
        spanId: 'span-9',
        snippet: 'Late payment shall incur interest at 1.5% per calendar month.',
        isAuthorized: true,
      ),
    ],
    modelName: 'DocuNexa-RAG',
    durationMs: 250,
  );

  setUp(() {
    mockBloc = MockQaBloc();
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  testWidgets('renders empty state prompt initially', (tester) async {
    when(() => mockBloc.state).thenReturn(const QaState());

    await tester.pumpWidget(buildTestableWidget(QaScreen(bloc: mockBloc)));

    expect(find.text('Grounded Document Q&A'), findsOneWidget);
    expect(find.text('Enterprise Evidence-Grounded Q&A'), findsOneWidget);
    expect(find.text('Ask a grounded question...'), findsOneWidget);
  });

  testWidgets('renders question, answer card and citation when conversation is present',
      (tester) async {
    when(() => mockBloc.state).thenReturn(QaState(
      conversation: [
        QaConversationTurn(
          question: 'What is the late fee policy?',
          answer: sampleAnswer,
        ),
      ],
    ));

    await tester.pumpWidget(buildTestableWidget(QaScreen(bloc: mockBloc)));

    expect(find.text('What is the late fee policy?'), findsOneWidget);
    expect(find.text('Late fee is 1.5% per month on overdue balances.'), findsOneWidget);
    expect(find.text('Grounded Answer'), findsOneWidget);
    expect(find.text('Standard Terms and Conditions'), findsOneWidget);
    expect(find.text('Verify Access'), findsOneWidget);
  });

  testWidgets('renders abstention badge when evidence is insufficient',
      (tester) async {
    final insufficientAnswer = QaAnswerResult(
      traceId: 'trace-101',
      question: 'What is the termination penalty?',
      answer: 'Unable to provide a verified answer due to lack of ground truth evidence in eligible documents.',
      status: QaStatus.insufficientEvidence,
      abstentionReason: 'No relevant clauses found in tenant documents.',
      confidence: 0.1,
      citations: const [],
      modelName: 'DocuNexa-RAG',
      durationMs: 120,
    );

    when(() => mockBloc.state).thenReturn(QaState(
      conversation: [
        QaConversationTurn(
          question: 'What is the termination penalty?',
          answer: insufficientAnswer,
        ),
      ],
    ));

    await tester.pumpWidget(buildTestableWidget(QaScreen(bloc: mockBloc)));

    expect(find.text('Insufficient Evidence'), findsOneWidget);
    expect(find.text('Notice: No relevant clauses found in tenant documents.'), findsOneWidget);
  });
}
