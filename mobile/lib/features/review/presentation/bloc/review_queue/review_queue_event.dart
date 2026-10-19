import 'package:equatable/equatable.dart';

abstract class ReviewQueueEvent extends Equatable {
  const ReviewQueueEvent();

  @override
  List<Object?> get props => [];
}

class FetchReviewQueue extends ReviewQueueEvent {
  final int page;
  final int limit;
  final String? status;
  final String? priority;

  const FetchReviewQueue({
    this.page = 1,
    this.limit = 20,
    this.status,
    this.priority,
  });

  @override
  List<Object?> get props => [page, limit, status, priority];
}

class RefreshReviewQueue extends ReviewQueueEvent {
  const RefreshReviewQueue();
}

class FilterReviewQueueByPriority extends ReviewQueueEvent {
  final String? priority;

  const FilterReviewQueueByPriority(this.priority);

  @override
  List<Object?> get props => [priority];
}
