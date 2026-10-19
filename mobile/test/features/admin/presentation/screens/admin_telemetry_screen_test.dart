import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/admin/domain/entities/admin_telemetry.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_bloc.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_event.dart';
import 'package:docunexa_mobile/features/admin/presentation/bloc/admin_state.dart';
import 'package:docunexa_mobile/features/admin/presentation/screens/admin_telemetry_screen.dart';

class MockAdminBloc extends MockBloc<AdminEvent, AdminState> implements AdminBloc {}

void main() {
  late MockAdminBloc mockBloc;

  final sampleTelemetry = AdminTelemetry(
    totalDocuments: 1250,
    documentsProcessedToday: 48,
    activeReviewTasks: 12,
    quarantinedDocuments: 2,
    activePoliciesCount: 5,
    systemUptime: '99.98%',
    activeLegalHolds: 3,
    storageUsageBytes: 104857600,
    dlqJobsCount: 4,
    lastRefreshedAt: DateTime(2026, 10, 17, 10, 0, 0),
  );

  setUp(() {
    mockBloc = MockAdminBloc();
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  testWidgets('renders loading state when telemetry is loading', (tester) async {
    when(() => mockBloc.state).thenReturn(const AdminState(isLoadingTelemetry: true));

    await tester.pumpWidget(buildTestableWidget(AdminTelemetryScreen(bloc: mockBloc)));

    expect(find.text('Operational Telemetry'), findsOneWidget);
    expect(find.text('Loading telemetry metrics...'), findsOneWidget);
  });

  testWidgets('renders permission denied card when user lacks administrator role', (tester) async {
    when(() => mockBloc.state).thenReturn(const AdminState(
      isPermissionDenied: true,
      permissionDeniedMessage: 'Administrative telemetry is restricted to Administrator and Operator roles.',
    ));

    await tester.pumpWidget(buildTestableWidget(AdminTelemetryScreen(bloc: mockBloc)));

    expect(find.text('Access Restricted'), findsOneWidget);
    expect(find.text('Administrative telemetry is restricted to Administrator and Operator roles.'), findsOneWidget);
  });

  testWidgets('renders KPI cards and operational health metrics when telemetry is loaded', (tester) async {
    when(() => mockBloc.state).thenReturn(AdminState(telemetry: sampleTelemetry));

    await tester.pumpWidget(buildTestableWidget(AdminTelemetryScreen(bloc: mockBloc)));

    expect(find.text('Operational Telemetry'), findsOneWidget);
    expect(find.text('1,250'), findsOneWidget);
    expect(find.text('Total Documents'), findsOneWidget);
    expect(find.text('Active Review Tasks'), findsOneWidget);
    expect(find.text('Active Legal Holds'), findsOneWidget);
    expect(find.text('System Uptime'), findsOneWidget);
    expect(find.text('99.98%'), findsOneWidget);
  });

  testWidgets('renders error view with retry action on failure', (tester) async {
    when(() => mockBloc.state).thenReturn(const AdminState(
      errorMessage: 'Telemetry service unavailable',
    ));

    await tester.pumpWidget(buildTestableWidget(AdminTelemetryScreen(bloc: mockBloc)));

    expect(find.text('Unable to load telemetry'), findsOneWidget);
    expect(find.text('Telemetry service unavailable'), findsOneWidget);
  });
}
