import '../entities/dashboard_kpi.dart';

abstract class DashboardRepository {
  Future<DashboardSummary> getDashboardSummary();
}
