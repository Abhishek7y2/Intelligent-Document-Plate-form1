import 'package:equatable/equatable.dart';
import '../../../domain/entities/approval_item.dart';

abstract class ApprovalQueueState extends Equatable {
  const ApprovalQueueState();

  @override
  List<Object?> get props => [];
}

class ApprovalQueueInitial extends ApprovalQueueState {}

class ApprovalQueueLoading extends ApprovalQueueState {}

class ApprovalQueueLoaded extends ApprovalQueueState {
  final List<ApprovalQueueItem> allItems;
  final List<ApprovalQueueItem> filteredItems;
  final ApprovalTier? selectedTier;

  const ApprovalQueueLoaded({
    required this.allItems,
    required this.filteredItems,
    this.selectedTier,
  });

  ApprovalQueueLoaded copyWith({
    List<ApprovalQueueItem>? allItems,
    List<ApprovalQueueItem>? filteredItems,
    ApprovalTier? selectedTier,
    bool clearTierFilter = false,
  }) {
    return ApprovalQueueLoaded(
      allItems: allItems ?? this.allItems,
      filteredItems: filteredItems ?? this.filteredItems,
      selectedTier: clearTierFilter ? null : (selectedTier ?? this.selectedTier),
    );
  }

  @override
  List<Object?> get props => [allItems, filteredItems, selectedTier];
}

class ApprovalQueueError extends ApprovalQueueState {
  final String message;

  const ApprovalQueueError(this.message);

  @override
  List<Object?> get props => [message];
}
