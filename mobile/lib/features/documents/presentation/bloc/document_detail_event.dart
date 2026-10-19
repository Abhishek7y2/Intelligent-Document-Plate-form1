import 'package:equatable/equatable.dart';

abstract class DocumentDetailEvent extends Equatable {
  const DocumentDetailEvent();

  @override
  List<Object?> get props => [];
}

class DocumentDetailFetchRequested extends DocumentDetailEvent {
  final String documentId;

  const DocumentDetailFetchRequested(this.documentId);

  @override
  List<Object?> get props => [documentId];
}
