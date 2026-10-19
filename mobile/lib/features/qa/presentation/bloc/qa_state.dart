import 'package:equatable/equatable.dart';
import '../../domain/entities/qa_entity.dart';

class QaConversationTurn extends Equatable {
  final String question;
  final QaAnswerResult? answer;
  final bool isLoading;
  final String? errorMessage;
  final String? feedbackGiven; // 'HELPFUL', 'NOT_HELPFUL', 'FLAGGED'

  const QaConversationTurn({
    required this.question,
    this.answer,
    this.isLoading = false,
    this.errorMessage,
    this.feedbackGiven,
  });

  QaConversationTurn copyWith({
    String? question,
    QaAnswerResult? answer,
    bool? isLoading,
    String? errorMessage,
    String? feedbackGiven,
  }) {
    return QaConversationTurn(
      question: question ?? this.question,
      answer: answer ?? this.answer,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      feedbackGiven: feedbackGiven ?? this.feedbackGiven,
    );
  }

  @override
  List<Object?> get props => [question, answer, isLoading, errorMessage, feedbackGiven];
}

class QaState extends Equatable {
  final List<QaAvailableDoc> availableDocuments;
  final String? selectedDocumentId;
  final String? selectedDocumentTitle;
  final List<QaConversationTurn> conversation;
  final bool isLoadingDocuments;
  final bool isAskingQuestion;
  final bool isVerifyingCitation;
  final CitationVerification? lastVerifiedCitation;
  final String? errorMessage;

  const QaState({
    this.availableDocuments = const [],
    this.selectedDocumentId,
    this.selectedDocumentTitle,
    this.conversation = const [],
    this.isLoadingDocuments = false,
    this.isAskingQuestion = false,
    this.isVerifyingCitation = false,
    this.lastVerifiedCitation,
    this.errorMessage,
  });

  QaState copyWith({
    List<QaAvailableDoc>? availableDocuments,
    String? selectedDocumentId,
    bool clearSelectedDocument = false,
    String? selectedDocumentTitle,
    List<QaConversationTurn>? conversation,
    bool? isLoadingDocuments,
    bool? isAskingQuestion,
    bool? isVerifyingCitation,
    CitationVerification? lastVerifiedCitation,
    bool clearVerifiedCitation = false,
    String? errorMessage,
    bool clearError = false,
  }) {
    return QaState(
      availableDocuments: availableDocuments ?? this.availableDocuments,
      selectedDocumentId: clearSelectedDocument
          ? null
          : (selectedDocumentId ?? this.selectedDocumentId),
      selectedDocumentTitle: clearSelectedDocument
          ? null
          : (selectedDocumentTitle ?? this.selectedDocumentTitle),
      conversation: conversation ?? this.conversation,
      isLoadingDocuments: isLoadingDocuments ?? this.isLoadingDocuments,
      isAskingQuestion: isAskingQuestion ?? this.isAskingQuestion,
      isVerifyingCitation: isVerifyingCitation ?? this.isVerifyingCitation,
      lastVerifiedCitation: clearVerifiedCitation
          ? null
          : (lastVerifiedCitation ?? this.lastVerifiedCitation),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [
        availableDocuments,
        selectedDocumentId,
        selectedDocumentTitle,
        conversation,
        isLoadingDocuments,
        isAskingQuestion,
        isVerifyingCitation,
        lastVerifiedCitation,
        errorMessage,
      ];
}
