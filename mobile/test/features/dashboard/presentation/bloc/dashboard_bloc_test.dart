import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/dashboard/domain/entities/dashboard_kpi.dart';
import 'package:docunexa_mobile/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/bloc/dashboard_bloc.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/bloc/dashboard_event.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/bloc/dashboard_state.dart';

class MockDashboardRepository extends Mock implements DashboardRepository {}

void main() {
  late MockDashboardRepository mockDashboardRepository;

  const testSummary = DashboardSummary(
    kpis: [
      KpiCard(
        label: 'Straight-Through Rate',
        value: '84.2%',
        delta: '+2.4%',
        isPositive: true,
        subtext: 'vs previous 30-day baseline',
      ),
      KpiCard(
        label: 'Total Processed',
        value: '1,420',
        delta: '+12%',
        isPositive: true,
        subtext: 'across all tenant streams',
      ),
    ],
    stpRatePercent: 84.2,
    totalProcessed: 1420,
    complianceScorePercent: 99.4,
    activeExceptions: 12,
    statusDistribution: {
      'APPROVED': 1200,
      'NEEDS_REVIEW': 150,
      'PROCESSING': 58,
      'QUARANTINED': 12,
    },
    generatedAt: '2026-10-17T10:00:00Z',
  );

  setUp(() {
    mockDashboardRepository = MockDashboardRepository();
  });

  group('DashboardBloc Tests', () {
    test('initial state is DashboardInitial', () {
      final bloc = DashboardBloc(dashboardRepository: mockDashboardRepository);
      expect(bloc.state, const DashboardInitial());
    });

    blocTest<DashboardBloc, DashboardState>(
      'emits [DashboardLoading, DashboardLoaded] when DashboardFetchRequested succeeds',
      build: () {
        when(() => mockDashboardRepository.getDashboardSummary())
            .thenAnswer((_) async => testSummary);
        return DashboardBloc(dashboardRepository: mockDashboardRepository);
      },
      act: (bloc) => bloc.add(const DashboardFetchRequested()),
      expect: () => [
        const DashboardLoading(),
        const DashboardLoaded(testSummary),
      ],
      verify: (_) {
        verify(() => mockDashboardRepository.getDashboardSummary()).called(1);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'emits [DashboardLoading, DashboardError] when DashboardFetchRequested fails with ApiException',
      build: () {
        when(() => mockDashboardRepository.getDashboardSummary()).thenThrow(
          const ApiException(
            message: 'Access forbidden: missing REPORT_GENERATE permission',
            statusCode: 403,
            correlationId: 'req-dash-403',
          ),
        );
        return DashboardBloc(dashboardRepository: mockDashboardRepository);
      },
      act: (bloc) => bloc.add(const DashboardFetchRequested()),
      expect: () => [
        const DashboardLoading(),
        const DashboardError(
          message: 'Access forbidden: missing REPORT_GENERATE permission',
          correlationId: 'req-dash-403',
        ),
      ],
    );

    blocTest<DashboardBloc, DashboardState>(
      'emits [DashboardLoaded] on DashboardRefreshRequested when refresh succeeds',
      build: () {
        when(() => mockDashboardRepository.getDashboardSummary())
            .thenAnswer((_) async => testSummary);
        return DashboardBloc(dashboardRepository: mockDashboardRepository);
      },
      act: (bloc) => bloc.add(const DashboardRefreshRequested()),
      expect: () => [
        const DashboardLoaded(testSummary),
      ],
      verify: (_) {
        verify(() => mockDashboardRepository.getDashboardSummary()).called(1);
      },
    );

    blocTest<DashboardBloc, DashboardState>(
      'emits [DashboardError] on DashboardRefreshRequested when network error occurs',
      build: () {
        when(() => mockDashboardRepository.getDashboardSummary()).thenThrow(
          const ApiException(
            message: 'Service unavailable. Please try again.',
            statusCode: 503,
          ),
        );
        return DashboardBloc(dashboardRepository: mockDashboardRepository);
      },
      act: (bloc) => bloc.add(const DashboardRefreshRequested()),
      expect: () => [
        const DashboardError(
          message: 'Service unavailable. Please try again.',
        ),
      ],
    );
  });
}
