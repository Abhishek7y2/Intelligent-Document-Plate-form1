import 'package:equatable/equatable.dart';
import '../../domain/entities/document.dart';

abstract class DocumentDetailState extends Equatable {
  const DocumentDetailState();

  @override
  List<Object?> get props => [];
}

class DocumentDetailInitial extends DocumentDetailState {
  const DocumentDetailInitial();
}

class DocumentDetailLoading extends DocumentDetailState {
  const DocumentDetailLoading();
}

class DocumentDetailLoaded extends DocumentDetailState {
  final DocumentDetail document;

  const DocumentDetailLoaded(this.document);

  @override
  List<Object?> get props => [document];
}

class DocumentDetailError extends DocumentDetailState {
  final String message;
  final String? correlationId;
  final int? statusCode;

  const DocumentDetailError({
    required this.message,
    this.correlationId,
    this.statusCode,
  });

  @override
  List<Object?> get props => [message, correlationId, statusCode];
}
