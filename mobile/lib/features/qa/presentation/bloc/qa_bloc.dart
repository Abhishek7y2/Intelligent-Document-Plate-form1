import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/qa_repository.dart';
import 'qa_event.dart';
import 'qa_state.dart';

class QaBloc extends Bloc<QaEvent, QaState> {
  final QaRepository repository;

  QaBloc({required this.repository}) : super(const QaState()) {
    on<QaLoadAvailableDocuments>(_onLoadAvailableDocuments);
    on<QaSelectDocumentScope>(_onSelectDocumentScope);
    on<QaAskQuestion>(_onAskQuestion);
    on<QaVerifyCitation>(_onVerifyCitation);
    on<QaSubmitFeedbackEvent>(_onSubmitFeedback);
    on<QaClearConversation>(_onClearConversation);
  }

  Future<void> _onLoadAvailableDocuments(
    QaLoadAvailableDocuments event,
    Emitter<QaState> emit,
  ) async {
    emit(state.copyWith(isLoadingDocuments: true, clearError: true));
    try {
      final docs = await repository.getAvailableDocuments();
      emit(state.copyWith(
        availableDocuments: docs,
        isLoadingDocuments: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoadingDocuments: false,
        errorMessage: e.toString(),
      ));
    }
  }

  void _onSelectDocumentScope(
    QaSelectDocumentScope event,
    Emitter<QaState> emit,
  ) {
    if (event.documentId == null) {
      emit(state.copyWith(
        clearSelectedDocument: true,
      ));
    } else {
      emit(state.copyWith(
        selectedDocumentId: event.documentId,
        selectedDocumentTitle: event.documentTitle ?? 'Selected Document',
      ));
    }
  }

  Future<void> _onAskQuestion(
    QaAskQuestion event,
    Emitter<QaState> emit,
  ) async {
    final trimmedQuestion = event.question.trim();
    if (trimmedQuestion.isEmpty) return;

    // Add new turn with loading state
    final newTurn = QaConversationTurn(
      question: trimmedQuestion,
      isLoading: true,
    );
    final updatedConversation = List<QaConversationTurn>.from(state.conversation)
      ..add(newTurn);

    emit(state.copyWith(
      conversation: updatedConversation,
      isAskingQuestion: true,
      clearError: true,
    ));

    try {
      final result = await repository.askQuestion(
        question: trimmedQuestion,
        documentId: state.selectedDocumentId,
      );

      final completedTurn = newTurn.copyWith(
        answer: result,
        isLoading: false,
      );
      final finalConversation = List<QaConversationTurn>.from(updatedConversation)
        ..[updatedConversation.length - 1] = completedTurn;

      emit(state.copyWith(
        conversation: finalConversation,
        isAskingQuestion: false,
      ));
    } catch (e) {
      final failedTurn = newTurn.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      final finalConversation = List<QaConversationTurn>.from(updatedConversation)
        ..[updatedConversation.length - 1] = failedTurn;

      emit(state.copyWith(
        conversation: finalConversation,
        isAskingQuestion: false,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onVerifyCitation(
    QaVerifyCitation event,
    Emitter<QaState> emit,
  ) async {
    emit(state.copyWith(isVerifyingCitation: true, clearVerifiedCitation: true));
    try {
      final verification = await repository.verifyCitation(
        documentId: event.documentId,
        citationId: event.citationId,
      );
      emit(state.copyWith(
        isVerifyingCitation: false,
        lastVerifiedCitation: verification,
      ));
    } catch (e) {
      emit(state.copyWith(
        isVerifyingCitation: false,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onSubmitFeedback(
    QaSubmitFeedbackEvent event,
    Emitter<QaState> emit,
  ) async {
    try {
      final success = await repository.submitFeedback(
        traceId: event.traceId,
        feedback: event.feedback,
      );
      if (success) {
        // Update the conversation turn that matches this traceId
        final updatedConversation = state.conversation.map((turn) {
          if (turn.answer?.traceId == event.traceId) {
            return turn.copyWith(feedbackGiven: event.feedback);
          }
          return turn;
        }).toList();

        emit(state.copyWith(conversation: updatedConversation));
      }
    } catch (e) {
      emit(state.copyWith(errorMessage: e.toString()));
    }
  }

  void _onClearConversation(
    QaClearConversation event,
    Emitter<QaState> emit,
  ) {
    emit(state.copyWith(
      conversation: const [],
      clearError: true,
      clearVerifiedCitation: true,
    ));
  }
}
