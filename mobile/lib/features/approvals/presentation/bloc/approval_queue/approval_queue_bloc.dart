import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/entities/approval_item.dart';
import '../../../domain/repositories/approval_repository.dart';
import 'approval_queue_event.dart';
import 'approval_queue_state.dart';

class ApprovalQueueBloc extends Bloc<ApprovalQueueEvent, ApprovalQueueState> {
  final ApprovalRepository repository;

  ApprovalQueueBloc({required this.repository}) : super(ApprovalQueueInitial()) {
    on<FetchApprovalQueue>(_onFetchApprovalQueue);
    on<RefreshApprovalQueue>(_onRefreshApprovalQueue);
    on<FilterApprovalQueueByTier>(_onFilterApprovalQueueByTier);
  }

  Future<void> _onFetchApprovalQueue(
    FetchApprovalQueue event,
    Emitter<ApprovalQueueState> emit,
  ) async {
    emit(ApprovalQueueLoading());
    try {
      final items = await repository.getApprovalQueue();
      emit(ApprovalQueueLoaded(
        allItems: items,
        filteredItems: items,
      ));
    } catch (e) {
      emit(ApprovalQueueError(e.toString()));
    }
  }

  Future<void> _onRefreshApprovalQueue(
    RefreshApprovalQueue event,
    Emitter<ApprovalQueueState> emit,
  ) async {
    final currentTier = state is ApprovalQueueLoaded
        ? (state as ApprovalQueueLoaded).selectedTier
        : null;

    try {
      final items = await repository.getApprovalQueue();
      final filtered = currentTier == null
          ? items
          : items.where((i) => i.tier == currentTier).toList();

      emit(ApprovalQueueLoaded(
        allItems: items,
        filteredItems: filtered,
        selectedTier: currentTier,
      ));
    } catch (e) {
      emit(ApprovalQueueError(e.toString()));
    }
  }

  void _onFilterApprovalQueueByTier(
    FilterApprovalQueueByTier event,
    Emitter<ApprovalQueueState> emit,
  ) {
    if (state is! ApprovalQueueLoaded) return;
    final currentState = state as ApprovalQueueLoaded;

    final filtered = event.tier == null
        ? currentState.allItems
        : currentState.allItems.where((i) => i.tier == event.tier).toList();

    emit(currentState.copyWith(
      filteredItems: filtered,
      selectedTier: event.tier,
      clearTierFilter: event.tier == null,
    ));
  }
}
