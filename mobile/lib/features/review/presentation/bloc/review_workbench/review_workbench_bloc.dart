import 'dart:typed_data';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/repositories/review_repository.dart';
import '../../data/datasources/review_exceptions.dart';
import 'review_workbench_event.dart';
import 'review_workbench_state.dart';

class ReviewWorkbenchBloc
    extends Bloc<ReviewWorkbenchEvent, ReviewWorkbenchState> {
  final ReviewRepository repository;

  ReviewWorkbenchBloc({required this.repository})
      : super(ReviewWorkbenchInitial()) {
    on<LoadReviewWorkbench>(_onLoadReviewWorkbench);
    on<SelectField>(_onSelectField);
    on<ChangeWorkbenchPage>(_onChangeWorkbenchPage);
    on<CorrectWorkbenchField>(_onCorrectWorkbenchField);
    on<SubmitWorkbenchDecision>(_onSubmitWorkbenchDecision);
  }

  Future<void> _onLoadReviewWorkbench(
    LoadReviewWorkbench event,
    Emitter<ReviewWorkbenchState> emit,
  ) async {
    emit(ReviewWorkbenchLoading());
    try {
      final workbench = await repository.getReviewWorkbench(event.documentId);

      // Start with first field selected if available
      final initialFieldKey =
          workbench.fields.isNotEmpty ? workbench.fields.first.key : null;

      emit(ReviewWorkbenchLoaded(
        workbench: workbench,
        selectedFieldKey: initialFieldKey,
        currentPage: 1,
        isImageLoading: true,
      ));

      // Attempt to load page 1 image
      try {
        final imageBytes = await repository.getDocumentPageImage(
          event.documentId,
          1,
        );
        if (state is ReviewWorkbenchLoaded) {
          emit((state as ReviewWorkbenchLoaded).copyWith(
            pageImageBytes: imageBytes,
            isImageLoading: false,
          ));
        }
      } catch (_) {
        // Image preview failure is non-blocking (e.g. mock environment)
        if (state is ReviewWorkbenchLoaded) {
          emit((state as ReviewWorkbenchLoaded).copyWith(
            isImageLoading: false,
          ));
        }
      }
    } on DocumentQuarantinedException catch (e) {
      emit(ReviewWorkbenchError(
        message: e.message,
        errorCode: 'DOCUMENT_QUARANTINED',
      ));
    } on DocumentNotEligibleException catch (e) {
      emit(ReviewWorkbenchError(
        message: e.message,
        errorCode: 'NOT_ELIGIBLE',
      ));
    } catch (e) {
      emit(ReviewWorkbenchError(message: e.toString()));
    }
  }

  Future<void> _onSelectField(
    SelectField event,
    Emitter<ReviewWorkbenchState> emit,
  ) async {
    if (state is! ReviewWorkbenchLoaded) return;
    final currentState = state as ReviewWorkbenchLoaded;

    // Check if the selected field has a bounding box on a different page
    int targetPage = currentState.currentPage;
    if (event.fieldKey != null) {
      final matchingBox = currentState.workbench.boundingBoxes.firstWhere(
        (b) => b.fieldKey.toLowerCase() == event.fieldKey!.toLowerCase(),
        orElse: () => currentState.workbench.boundingBoxes.first,
      );
      if (matchingBox.fieldKey.toLowerCase() == event.fieldKey!.toLowerCase()) {
        targetPage = matchingBox.page;
      }
    }

    if (targetPage != currentState.currentPage) {
      add(ChangeWorkbenchPage(targetPage));
    }

    emit(currentState.copyWith(
      selectedFieldKey: event.fieldKey,
      clearSubmitError: true,
    ));
  }

  Future<void> _onChangeWorkbenchPage(
    ChangeWorkbenchPage event,
    Emitter<ReviewWorkbenchState> emit,
  ) async {
    if (state is! ReviewWorkbenchLoaded) return;
    final currentState = state as ReviewWorkbenchLoaded;

    if (event.pageNumber == currentState.currentPage &&
        currentState.pageImageBytes != null) {
      return;
    }

    emit(currentState.copyWith(
      currentPage: event.pageNumber,
      isImageLoading: true,
      pageImageBytes: null,
    ));

    try {
      final imageBytes = await repository.getDocumentPageImage(
        currentState.workbench.documentId,
        event.pageNumber,
      );
      if (state is ReviewWorkbenchLoaded) {
        emit((state as ReviewWorkbenchLoaded).copyWith(
          pageImageBytes: imageBytes,
          isImageLoading: false,
        ));
      }
    } catch (_) {
      if (state is ReviewWorkbenchLoaded) {
        emit((state as ReviewWorkbenchLoaded).copyWith(
          isImageLoading: false,
        ));
      }
    }
  }

  Future<void> _onCorrectWorkbenchField(
    CorrectWorkbenchField event,
    Emitter<ReviewWorkbenchState> emit,
  ) async {
    if (state is! ReviewWorkbenchLoaded) return;
    final currentState = state as ReviewWorkbenchLoaded;
    if (currentState.isSubmitting) return;

    emit(currentState.copyWith(isSubmitting: true, clearSubmitError: true));

    try {
      final updatedWorkbench = await repository.correctField(
        documentId: currentState.workbench.documentId,
        fieldKey: event.fieldKey,
        correctedValue: event.correctedValue,
        reason: event.reason,
      );

      emit(currentState.copyWith(
        workbench: updatedWorkbench,
        isSubmitting: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        isSubmitting: false,
        submitError: 'Failed to correct field: ${e.toString()}',
      ));
    }
  }

  Future<void> _onSubmitWorkbenchDecision(
    SubmitWorkbenchDecision event,
    Emitter<ReviewWorkbenchState> emit,
  ) async {
    if (state is! ReviewWorkbenchLoaded) return;
    final currentState = state as ReviewWorkbenchLoaded;
    if (currentState.isSubmitting) return;

    emit(currentState.copyWith(isSubmitting: true, clearSubmitError: true));

    try {
      final result = await repository.submitReviewDecision(
        documentId: currentState.workbench.documentId,
        action: event.action,
        comments: event.comments,
        overrideReason: event.overrideReason,
      );

      emit(ReviewWorkbenchDecisionSuccess(result));
    } on InvoiceMathMismatchException catch (e) {
      emit(currentState.copyWith(
        isSubmitting: false,
        submitError: e.message,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        isSubmitting: false,
        submitError: 'Review submission error: ${e.toString()}',
      ));
    }
  }
}
