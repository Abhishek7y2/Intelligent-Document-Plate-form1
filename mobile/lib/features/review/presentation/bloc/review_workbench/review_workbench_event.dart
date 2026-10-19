import 'package:equatable/equatable.dart';

abstract class ReviewWorkbenchEvent extends Equatable {
  const ReviewWorkbenchEvent();

  @override
  List<Object?> get props => [];
}

class LoadReviewWorkbench extends ReviewWorkbenchEvent {
  final String documentId;

  const LoadReviewWorkbench(this.documentId);

  @override
  List<Object?> get props => [documentId];
}

class SelectField extends ReviewWorkbenchEvent {
  final String? fieldKey;

  const SelectField(this.fieldKey);

  @override
  List<Object?> get props => [fieldKey];
}

class ChangeWorkbenchPage extends ReviewWorkbenchEvent {
  final int pageNumber;

  const ChangeWorkbenchPage(this.pageNumber);

  @override
  List<Object?> get props => [pageNumber];
}

class CorrectWorkbenchField extends ReviewWorkbenchEvent {
  final String fieldKey;
  final String correctedValue;
  final String reason;

  const CorrectWorkbenchField({
    required this.fieldKey,
    required this.correctedValue,
    required this.reason,
  });

  @override
  List<Object?> get props => [fieldKey, correctedValue, reason];
}

class SubmitWorkbenchDecision extends ReviewWorkbenchEvent {
  final String action; // 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
  final String? comments;
  final String? overrideReason;

  const SubmitWorkbenchDecision({
    required this.action,
    this.comments,
    this.overrideReason,
  });

  @override
  List<Object?> get props => [action, comments, overrideReason];
}
