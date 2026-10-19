import 'package:equatable/equatable.dart';

abstract class DashboardEvent extends Equatable {
  const DashboardEvent();

  @override
  List<Object?> get props => [];
}

class DashboardFetchRequested extends DashboardEvent {
  const DashboardFetchRequested();
}

class DashboardRefreshRequested extends DashboardEvent {
  const DashboardRefreshRequested();
}
