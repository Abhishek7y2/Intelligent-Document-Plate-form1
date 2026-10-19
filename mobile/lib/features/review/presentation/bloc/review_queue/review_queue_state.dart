import 'package:equatable/equatable.dart';
import '../../../domain/entities/review_task.dart';

abstract class ReviewQueueState extends Equatable {
  const ReviewQueueState();

  @override
  List<Object?> get props => [];
}

class ReviewQueueInitial extends ReviewQueueState {}

class ReviewQueueLoading extends ReviewQueueState {}

class ReviewQueueLoaded extends ReviewQueueState {
  final List<ReviewTaskItem> tasks;
  final int total;
  final int page;
  final bool hasMore;
  final String? selectedPriority;

  const ReviewQueueLoaded({
    required this.tasks,
    required this.total,
    required this.page,
    required this.hasMore,
    this.selectedPriority,
  });

  ReviewQueueLoaded copyWith({
    List<ReviewTaskItem>? tasks,
    int? total,
    int? page,
    bool? hasMore,
    String? selectedPriority,
  }) {
    return ReviewQueueLoaded(
      tasks: tasks ?? this.tasks,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      selectedPriority: selectedPriority ?? this.selectedPriority,
    );
  }

  @override
  List<Object?> get props => [tasks, total, page, hasMore, selectedPriority];
}

class ReviewQueueError extends ReviewQueueState {
  final String message;
  final String? errorCode;

  const ReviewQueueError({
    required this.message,
    this.errorCode,
  });

  @override
  List<Object?> get props => [message, errorCode];
}
