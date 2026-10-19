import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/legal_hold/domain/entities/legal_hold_item.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_bloc.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_event.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_state.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/screens/legal_hold_screen.dart';

class MockLegalHoldBloc extends MockBloc<LegalHoldEvent, LegalHoldState> implements LegalHoldBloc {}

void main() {
  late MockLegalHoldBloc mockBloc;

  final sampleHold = LegalHoldItem(
    id: 'hold-777',
    matterName: 'SEC Inquiry - Q3 Revenue Recognition',
    matterNumber: 'MAT-2026-0099',
    reason: 'Formal regulatory hold requiring immediate document freeze across financial records.',
    scopeDocumentIds: const ['doc-1', 'doc-2'],
    scopeDocumentType: 'FINANCIAL_STATEMENT',
    status: LegalHoldStatus.active,
    placedBy: 'usr-admin-1',
    placedAt: DateTime(2026, 10, 16, 11, 0),
    activeDocumentCount: 2,
  );

  setUp(() {
    mockBloc = MockLegalHoldBloc();
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  testWidgets('renders loading state when legal holds are fetching', (tester) async {
    when(() => mockBloc.state).thenReturn(const LegalHoldState(isLoading: true));

    await tester.pumpWidget(buildTestableWidget(LegalHoldScreen(bloc: mockBloc)));

    expect(find.text('Legal Hold & Retention'), findsOneWidget);
    expect(find.text('Loading legal holds...'), findsOneWidget);
  });

  testWidgets('renders empty state when no holds exist', (tester) async {
    when(() => mockBloc.state).thenReturn(const LegalHoldState(holds: []));

    await tester.pumpWidget(buildTestableWidget(LegalHoldScreen(bloc: mockBloc)));

    expect(find.text('No Legal Holds Found'), findsOneWidget);
    expect(find.text('No legal holds currently match the selected filter.'), findsOneWidget);
    expect(find.text('Place Legal Hold'), findsOneWidget);
  });

  testWidgets('renders active hold card with matter name, hold ID, reason, and release action', (tester) async {
    when(() => mockBloc.state).thenReturn(LegalHoldState(holds: [sampleHold]));

    await tester.pumpWidget(buildTestableWidget(LegalHoldScreen(bloc: mockBloc)));

    expect(find.text('SEC Inquiry - Q3 Revenue Recognition'), findsOneWidget);
    expect(find.text('Hold ID: hold-777 • Matter: MAT-2026-0099'), findsOneWidget);
    expect(find.text('Formal regulatory hold requiring immediate document freeze across financial records.'), findsOneWidget);
    expect(find.text('Release Hold'), findsOneWidget);
    expect(find.text('ACTIVE'), findsOneWidget);
  });

  testWidgets('renders permission denied card when user lacks ADMIN_ACCESS', (tester) async {
    when(() => mockBloc.state).thenReturn(const LegalHoldState(
      isPermissionDenied: true,
      permissionDeniedMessage: 'Inspecting legal holds requires the ADMIN_ACCESS permission.',
    ));

    await tester.pumpWidget(buildTestableWidget(LegalHoldScreen(bloc: mockBloc)));

    expect(find.text('Access Restricted'), findsOneWidget);
    expect(find.text('Inspecting legal holds requires the ADMIN_ACCESS permission.'), findsOneWidget);
  });
}
