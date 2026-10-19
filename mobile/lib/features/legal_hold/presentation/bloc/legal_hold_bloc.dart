import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/repositories/legal_hold_repository.dart';
import 'legal_hold_event.dart';
import 'legal_hold_state.dart';

class LegalHoldBloc extends Bloc<LegalHoldEvent, LegalHoldState> {
  final LegalHoldRepository repository;

  LegalHoldBloc({required this.repository}) : super(const LegalHoldState()) {
    on<LegalHoldFetchRequested>(_onFetchRequested);
    on<LegalHoldPlaceRequested>(_onPlaceRequested);
    on<LegalHoldReleaseRequested>(_onReleaseRequested);
  }

  Future<void> _onFetchRequested(
    LegalHoldFetchRequested event,
    Emitter<LegalHoldState> emit,
  ) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final holds = await repository.getLegalHolds();
      emit(state.copyWith(
        isLoading: false,
        holds: holds,
        isPermissionDenied: false,
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isLoading: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Inspecting legal holds requires the ADMIN_ACCESS permission.',
        ));
      } else {
        emit(state.copyWith(
          isLoading: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }

  Future<void> _onPlaceRequested(
    LegalHoldPlaceRequested event,
    Emitter<LegalHoldState> emit,
  ) async {
    if (state.isSubmitting) return;
    emit(state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true));
    try {
      final newHold = await repository.placeLegalHold(
        matterName: event.matterName,
        matterNumber: event.matterNumber,
        reason: event.reason,
        scopeDocumentIds: event.scopeDocumentIds,
        scopeDocumentType: event.scopeDocumentType,
      );

      final updatedHolds = [newHold, ...state.holds];
      emit(state.copyWith(
        isSubmitting: false,
        holds: updatedHolds,
        successMessage: "Legal hold '${newHold.id}' placed on matter '${newHold.matterName}'",
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isSubmitting: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Placing legal holds requires the ADMIN_ACCESS permission.',
        ));
      } else {
        emit(state.copyWith(
          isSubmitting: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }

  Future<void> _onReleaseRequested(
    LegalHoldReleaseRequested event,
    Emitter<LegalHoldState> emit,
  ) async {
    if (state.isSubmitting) return;
    emit(state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true));
    try {
      final releasedHold = await repository.releaseLegalHold(
        holdId: event.holdId,
        releaseReason: event.releaseReason,
      );

      final updatedHolds = state.holds.map((h) {
        if (h.id == event.holdId) {
          return releasedHold;
        }
        return h;
      }).toList();

      emit(state.copyWith(
        isSubmitting: false,
        holds: updatedHolds,
        successMessage: "Legal hold '${event.holdId}' released successfully",
      ));
    } catch (e) {
      if (e is ForbiddenException) {
        emit(state.copyWith(
          isSubmitting: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Releasing legal holds requires the ADMIN_ACCESS permission.',
        ));
      } else {
        emit(state.copyWith(
          isSubmitting: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ));
      }
    }
  }
}
