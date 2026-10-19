import 'package:equatable/equatable.dart';
import '../../../domain/entities/approval_item.dart';

abstract class ApprovalQueueEvent extends Equatable {
  const ApprovalQueueEvent();

  @override
  List<Object?> get props => [];
}

class FetchApprovalQueue extends ApprovalQueueEvent {
  const FetchApprovalQueue();
}

class RefreshApprovalQueue extends ApprovalQueueEvent {
  const RefreshApprovalQueue();
}

class FilterApprovalQueueByTier extends ApprovalQueueEvent {
  final ApprovalTier? tier;

  const FilterApprovalQueueByTier(this.tier);

  @override
  List<Object?> get props => [tier];
}
