import 'package:equatable/equatable.dart';
import '../../domain/entities/dashboard_kpi.dart';

abstract class DashboardState extends Equatable {
  const DashboardState();

  @override
  List<Object?> get props => [];
}

class DashboardInitial extends DashboardState {
  const DashboardInitial();
}

class DashboardLoading extends DashboardState {
  const DashboardLoading();
}

class DashboardLoaded extends DashboardState {
  final DashboardSummary summary;

  const DashboardLoaded(this.summary);

  @override
  List<Object?> get props => [summary];
}

class DashboardError extends DashboardState {
  final String message;
  final String? correlationId;

  const DashboardError({required this.message, this.correlationId});

  @override
  List<Object?> get props => [message, correlationId];
}
