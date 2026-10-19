import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/theme/app_theme.dart';
import 'package:docunexa_mobile/features/auth/domain/entities/user.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_state.dart';
import 'package:docunexa_mobile/features/dashboard/domain/entities/dashboard_kpi.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/bloc/dashboard_bloc.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/bloc/dashboard_event.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/bloc/dashboard_state.dart';
import 'package:docunexa_mobile/features/dashboard/presentation/screens/dashboard_screen.dart';

class MockDashboardBloc extends MockBloc<DashboardEvent, DashboardState>
    implements DashboardBloc {}

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockDashboardBloc mockDashboardBloc;
  late MockAuthBloc mockAuthBloc;

  const testUser = User(
    userId: 'USR-88210',
    email: 'analyst@docunexa.io',
    tenantId: 'TNT-CORP-01',
    fullName: 'Jane Doe',
    role: 'Reviewer',
    permissions: ['DOCUMENT_READ'],
  );

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
      KpiCard(
        label: 'Compliance Score',
        value: '99.4%',
        delta: '0.0%',
        isPositive: true,
        subtext: 'audit-verified rules',
      ),
      KpiCard(
        label: 'Active Exceptions',
        value: 12,
        delta: '-3',
        isPositive: true,
        subtext: 'requiring manual attention',
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
    mockDashboardBloc = MockDashboardBloc();
    mockAuthBloc = MockAuthBloc();
    when(() => mockAuthBloc.state).thenReturn(const Authenticated(user: testUser));
  });

  Widget createWidgetUnderTest() {
    return MaterialApp(
      theme: AppTheme.darkTheme,
      home: BlocProvider<AuthBloc>.value(
        value: mockAuthBloc,
        child: DashboardScreen(bloc: mockDashboardBloc),
      ),
    );
  }

  group('DashboardScreen Widget Tests', () {
    testWidgets('renders loading indicator when DashboardLoading', (tester) async {
      when(() => mockDashboardBloc.state).thenReturn(const DashboardLoading());

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Operations Dashboard'), findsOneWidget);
      expect(find.text('Aggregating operational metrics...'), findsOneWidget);
    });

    testWidgets('renders error view with retry action when DashboardError', (tester) async {
      when(() => mockDashboardBloc.state).thenReturn(
        const DashboardError(
          message: 'Unable to reach metrics service',
          correlationId: 'req-err-772',
        ),
      );

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Unable to load operational dashboard'), findsOneWidget);
      expect(find.text('Unable to reach metrics service'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('renders KPI cards, status distribution, and quick actions when DashboardLoaded', (tester) async {
      when(() => mockDashboardBloc.state).thenReturn(const DashboardLoaded(testSummary));

      await tester.pumpWidget(createWidgetUnderTest());

      // Header user name
      expect(find.text('Jane Doe'), findsOneWidget);
      expect(find.text('Tenant: TNT-CORP-01 | Reviewer'), findsOneWidget);

      // KPI cards
      expect(find.text('Straight-Through Rate'), findsOneWidget);
      expect(find.text('84.2%'), findsOneWidget);
      expect(find.text('Total Processed'), findsOneWidget);
      expect(find.text('1,420'), findsOneWidget);
      expect(find.text('Compliance Score'), findsOneWidget);
      expect(find.text('Active Exceptions'), findsOneWidget);

      // Status distribution
      expect(find.text('Processing Pipeline Distribution'), findsOneWidget);

      // Quick actions
      expect(find.text('Document Catalog'), findsOneWidget);
    });
  });
}
