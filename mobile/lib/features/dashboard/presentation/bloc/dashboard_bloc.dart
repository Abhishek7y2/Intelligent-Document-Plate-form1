import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/repositories/dashboard_repository.dart';
import 'dashboard_event.dart';
import 'dashboard_state.dart';

class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  final DashboardRepository _dashboardRepository;

  DashboardBloc({required DashboardRepository dashboardRepository})
      : _dashboardRepository = dashboardRepository,
        super(const DashboardInitial()) {
    on<DashboardFetchRequested>(_onDashboardFetchRequested);
    on<DashboardRefreshRequested>(_onDashboardRefreshRequested);
  }

  Future<void> _onDashboardFetchRequested(
    DashboardFetchRequested event,
    Emitter<DashboardState> emit,
  ) async {
    emit(const DashboardLoading());
    try {
      final summary = await _dashboardRepository.getDashboardSummary();
      emit(DashboardLoaded(summary));
    } on ApiException catch (e) {
      emit(DashboardError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(DashboardError(message: e.toString()));
    }
  }

  Future<void> _onDashboardRefreshRequested(
    DashboardRefreshRequested event,
    Emitter<DashboardState> emit,
  ) async {
    try {
      final summary = await _dashboardRepository.getDashboardSummary();
      emit(DashboardLoaded(summary));
    } on ApiException catch (e) {
      emit(DashboardError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(DashboardError(message: e.toString()));
    }
  }
}
