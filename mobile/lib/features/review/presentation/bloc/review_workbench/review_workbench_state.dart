import 'dart:typed_data';
import 'package:equatable/equatable.dart';
import '../../../domain/entities/review_workbench.dart';

abstract class ReviewWorkbenchState extends Equatable {
  const ReviewWorkbenchState();

  @override
  List<Object?> get props => [];
}

class ReviewWorkbenchInitial extends ReviewWorkbenchState {}

class ReviewWorkbenchLoading extends ReviewWorkbenchState {}

class ReviewWorkbenchLoaded extends ReviewWorkbenchState {
  final ReviewWorkbench workbench;
  final String? selectedFieldKey;
  final int currentPage;
  final Uint8List? pageImageBytes;
  final bool isImageLoading;
  final bool isSubmitting;
  final String? submitError;

  const ReviewWorkbenchLoaded({
    required this.workbench,
    this.selectedFieldKey,
    this.currentPage = 1,
    this.pageImageBytes,
    this.isImageLoading = false,
    this.isSubmitting = false,
    this.submitError,
  });

  ReviewWorkbenchLoaded copyWith({
    ReviewWorkbench? workbench,
    String? selectedFieldKey,
    int? currentPage,
    Uint8List? pageImageBytes,
    bool? isImageLoading,
    bool? isSubmitting,
    String? submitError,
    bool clearSubmitError = false,
  }) {
    return ReviewWorkbenchLoaded(
      workbench: workbench ?? this.workbench,
      selectedFieldKey: selectedFieldKey ?? this.selectedFieldKey,
      currentPage: currentPage ?? this.currentPage,
      pageImageBytes: pageImageBytes ?? this.pageImageBytes,
      isImageLoading: isImageLoading ?? this.isImageLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    );
  }

  @override
  List<Object?> get props => [
        workbench,
        selectedFieldKey,
        currentPage,
        pageImageBytes,
        isImageLoading,
        isSubmitting,
        submitError,
      ];
}

class ReviewWorkbenchDecisionSuccess extends ReviewWorkbenchState {
  final ReviewDecisionResult result;

  const ReviewWorkbenchDecisionSuccess(this.result);

  @override
  List<Object?> get props => [result];
}

class ReviewWorkbenchError extends ReviewWorkbenchState {
  final String message;
  final String? errorCode;

  const ReviewWorkbenchError({
    required this.message,
    this.errorCode,
  });

  @override
  List<Object?> get props => [message, errorCode];
}
