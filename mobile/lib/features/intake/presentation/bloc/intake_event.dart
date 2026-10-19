import 'package:equatable/equatable.dart';
import '../../domain/entities/intake_document.dart';

abstract class IntakeEvent extends Equatable {
  const IntakeEvent();

  @override
  List<Object?> get props => [];
}

class IntakePickFileRequested extends IntakeEvent {
  const IntakePickFileRequested();
}

class IntakeScanCameraRequested extends IntakeEvent {
  const IntakeScanCameraRequested();
}

class IntakeDocumentSelected extends IntakeEvent {
  final SelectedDocument document;

  const IntakeDocumentSelected(this.document);

  @override
  List<Object?> get props => [document];
}

class IntakeDocumentTypeChanged extends IntakeEvent {
  final String documentType;

  const IntakeDocumentTypeChanged(this.documentType);

  @override
  List<Object?> get props => [documentType];
}

class IntakeDocumentRemoved extends IntakeEvent {
  const IntakeDocumentRemoved();
}

class IntakeUploadStarted extends IntakeEvent {
  final bool allowDuplicate;

  const IntakeUploadStarted({this.allowDuplicate = false});

  @override
  List<Object?> get props => [allowDuplicate];
}

class IntakeUploadProgressUpdated extends IntakeEvent {
  final int sentBytes;
  final int totalBytes;

  const IntakeUploadProgressUpdated({
    required this.sentBytes,
    required this.totalBytes,
  });

  @override
  List<Object?> get props => [sentBytes, totalBytes];
}

class IntakeUploadCancelled extends IntakeEvent {
  const IntakeUploadCancelled();
}

class IntakeReset extends IntakeEvent {
  const IntakeReset();
}
