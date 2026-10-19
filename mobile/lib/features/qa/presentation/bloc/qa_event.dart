import 'package:equatable/equatable.dart';

abstract class QaEvent extends Equatable {
  const QaEvent();

  @override
  List<Object?> get props => [];
}

class QaLoadAvailableDocuments extends QaEvent {
  const QaLoadAvailableDocuments();
}

class QaSelectDocumentScope extends QaEvent {
  final String? documentId;
  final String? documentTitle;

  const QaSelectDocumentScope({this.documentId, this.documentTitle});

  @override
  List<Object?> get props => [documentId, documentTitle];
}

class QaAskQuestion extends QaEvent {
  final String question;

  const QaAskQuestion(this.question);

  @override
  List<Object?> get props => [question];
}

class QaVerifyCitation extends QaEvent {
  final String documentId;
  final String citationId;

  const QaVerifyCitation({
    required this.documentId,
    required this.citationId,
  });

  @override
  List<Object?> get props => [documentId, citationId];
}

class QaSubmitFeedbackEvent extends QaEvent {
  final String traceId;
  final String feedback; // 'HELPFUL' | 'NOT_HELPFUL' | 'FLAGGED'

  const QaSubmitFeedbackEvent({
    required this.traceId,
    required this.feedback,
  });

  @override
  List<Object?> get props => [traceId, feedback];
}

class QaClearConversation extends QaEvent {
  const QaClearConversation();
}
