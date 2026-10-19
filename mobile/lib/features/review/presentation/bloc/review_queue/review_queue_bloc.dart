import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/repositories/review_repository.dart';
import 'review_queue_event.dart';
import 'review_queue_state.dart';

class ReviewQueueBloc extends Bloc<ReviewQueueEvent, ReviewQueueState> {
  final ReviewRepository repository;

  ReviewQueueBloc({required this.repository}) : super(ReviewQueueInitial()) {
    on<FetchReviewQueue>(_onFetchReviewQueue);
    on<RefreshReviewQueue>(_onRefreshReviewQueue);
    on<FilterReviewQueueByPriority>(_onFilterReviewQueueByPriority);
  }

  Future<void> _onFetchReviewQueue(
    FetchReviewQueue event,
    Emitter<ReviewQueueState> emit,
  ) async {
    emit(ReviewQueueLoading());
    try {
      final tasks = await repository.getReviewQueue(
        status: event.status,
        priority: event.priority,
        page: event.page,
        limit: event.limit,
      );

      emit(ReviewQueueLoaded(
        tasks: tasks,
        total: tasks.length, // backend array length or total
        page: event.page,
        hasMore: tasks.length >= event.limit,
        selectedPriority: event.priority,
      ));
    } catch (e) {
      emit(ReviewQueueError(message: e.toString()));
    }
  }

  Future<void> _onRefreshReviewQueue(
    RefreshReviewQueue event,
    Emitter<ReviewQueueState> emit,
  ) async {
    final currentPriority = state is ReviewQueueLoaded
        ? (state as ReviewQueueLoaded).selectedPriority
        : null;

    try {
      final tasks = await repository.getReviewQueue(
        priority: currentPriority,
        page: 1,
        limit: 20,
      );

      emit(ReviewQueueLoaded(
        tasks: tasks,
        total: tasks.length,
        page: 1,
        hasMore: tasks.length >= 20,
        selectedPriority: currentPriority,
      ));
    } catch (e) {
      emit(ReviewQueueError(message: e.toString()));
    }
  }

  Future<void> _onFilterReviewQueueByPriority(
    FilterReviewQueueByPriority event,
    Emitter<ReviewQueueState> emit,
  ) async {
    emit(ReviewQueueLoading());
    try {
      final tasks = await repository.getReviewQueue(
        priority: event.priority,
        page: 1,
        limit: 20,
      );

      emit(ReviewQueueLoaded(
        tasks: tasks,
        total: tasks.length,
        page: 1,
        hasMore: tasks.length >= 20,
        selectedPriority: event.priority,
      ));
    } catch (e) {
      emit(ReviewQueueError(message: e.toString()));
    }
  }
}
