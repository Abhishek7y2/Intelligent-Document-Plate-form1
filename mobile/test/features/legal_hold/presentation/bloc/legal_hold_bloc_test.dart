import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/network/network_exceptions.dart';
import 'package:docunexa_mobile/features/legal_hold/domain/entities/legal_hold_item.dart';
import 'package:docunexa_mobile/features/legal_hold/domain/repositories/legal_hold_repository.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_bloc.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_event.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_state.dart';

class MockLegalHoldRepository extends Mock implements LegalHoldRepository {}

void main() {
  late MockLegalHoldRepository mockRepository;
  late LegalHoldBloc bloc;

  final sampleActiveHold = LegalHoldItem(
    id: 'hold-101',
    matterName: 'DOJ vs Acme Corp',
    matterNumber: 'MAT-2026-0044',
    reason: 'Subpoena issued for Q3 transactions and related executive communications',
    scopeDocumentIds: const ['doc-11', 'doc-22'],
    scopeDocumentType: 'CONTRACT',
    status: LegalHoldStatus.active,
    placedBy: 'usr-admin-1',
    placedAt: DateTime(2026, 10, 15, 14, 0),
    activeDocumentCount: 2,
  );

  final sampleReleasedHold = LegalHoldItem(
    id: 'hold-101',
    matterName: 'DOJ vs Acme Corp',
    matterNumber: 'MAT-2026-0044',
    reason: 'Subpoena issued for Q3 transactions and related executive communications',
    scopeDocumentIds: const ['doc-11', 'doc-22'],
    scopeDocumentType: 'CONTRACT',
    status: LegalHoldStatus.released,
    placedBy: 'usr-admin-1',
    placedAt: DateTime(2026, 10, 15, 14, 0),
    releasedBy: 'usr-admin-1',
    releasedAt: DateTime(2026, 10, 17, 10, 30),
    releaseReason: 'Matter settled and regulatory consent decree satisfied.',
    activeDocumentCount: 0,
  );

  setUp(() {
    mockRepository = MockLegalHoldRepository();
    bloc = LegalHoldBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('LegalHoldBloc Tests', () {
    test('initial state is default LegalHoldState', () {
      expect(bloc.state, const LegalHoldState());
    });

    blocTest<LegalHoldBloc, LegalHoldState>(
      'emits holds when LegalHoldFetchRequested succeeds',
      build: () {
        when(() => mockRepository.getLegalHolds())
            .thenAnswer((_) async => [sampleActiveHold]);
        return bloc;
      },
      act: (b) => b.add(const LegalHoldFetchRequested()),
      expect: () => [
        const LegalHoldState(isLoading: true),
        LegalHoldState(
          isLoading: false,
          holds: [sampleActiveHold],
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<LegalHoldBloc, LegalHoldState>(
      'emits permission-denied state when LegalHoldFetchRequested throws ForbiddenException',
      build: () {
        when(() => mockRepository.getLegalHolds())
            .thenThrow(ForbiddenException('ADMIN_ACCESS required'));
        return bloc;
      },
      act: (b) => b.add(const LegalHoldFetchRequested()),
      expect: () => [
        const LegalHoldState(isLoading: true),
        const LegalHoldState(
          isLoading: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Inspecting legal holds requires the ADMIN_ACCESS permission.',
        ),
      ],
    );

    blocTest<LegalHoldBloc, LegalHoldState>(
      'places legal hold and prepends to holds list upon LegalHoldPlaceRequested',
      build: () {
        when(() => mockRepository.placeLegalHold(
              matterName: 'DOJ vs Acme Corp',
              matterNumber: 'MAT-2026-0044',
              reason: 'Subpoena issued for Q3 transactions and related executive communications',
              scopeDocumentIds: const ['doc-11', 'doc-22'],
              scopeDocumentType: 'CONTRACT',
            )).thenAnswer((_) async => sampleActiveHold);
        return bloc;
      },
      act: (b) => b.add(const LegalHoldPlaceRequested(
        matterName: 'DOJ vs Acme Corp',
        matterNumber: 'MAT-2026-0044',
        reason: 'Subpoena issued for Q3 transactions and related executive communications',
        scopeDocumentIds: ['doc-11', 'doc-22'],
        scopeDocumentType: 'CONTRACT',
      )),
      expect: () => [
        const LegalHoldState(isSubmitting: true),
        LegalHoldState(
          isSubmitting: false,
          holds: [sampleActiveHold],
          successMessage: "Legal hold 'hold-101' placed on matter 'DOJ vs Acme Corp'",
        ),
      ],
    );

    blocTest<LegalHoldBloc, LegalHoldState>(
      'emits permission denied when LegalHoldPlaceRequested lacks ADMIN_ACCESS',
      build: () {
        when(() => mockRepository.placeLegalHold(
              matterName: 'SEC Investigation',
              matterNumber: 'SEC-88',
              reason: 'Informal enquiry',
            )).thenThrow(ForbiddenException('Forbidden'));
        return bloc;
      },
      act: (b) => b.add(const LegalHoldPlaceRequested(
        matterName: 'SEC Investigation',
        matterNumber: 'SEC-88',
        reason: 'Informal enquiry',
      )),
      expect: () => [
        const LegalHoldState(isSubmitting: true),
        const LegalHoldState(
          isSubmitting: false,
          isPermissionDenied: true,
          permissionDeniedMessage: 'Placing legal holds requires the ADMIN_ACCESS permission.',
        ),
      ],
    );

    blocTest<LegalHoldBloc, LegalHoldState>(
      'releases legal hold and updates hold in list upon LegalHoldReleaseRequested',
      seed: () => LegalHoldState(holds: [sampleActiveHold]),
      build: () {
        when(() => mockRepository.releaseLegalHold(
              holdId: 'hold-101',
              releaseReason: 'Matter settled and regulatory consent decree satisfied.',
            )).thenAnswer((_) async => sampleReleasedHold);
        return bloc;
      },
      act: (b) => b.add(const LegalHoldReleaseRequested(
        holdId: 'hold-101',
        releaseReason: 'Matter settled and regulatory consent decree satisfied.',
      )),
      expect: () => [
        LegalHoldState(holds: [sampleActiveHold], isSubmitting: true),
        LegalHoldState(
          isSubmitting: false,
          holds: [sampleReleasedHold],
          successMessage: "Legal hold 'hold-101' released successfully",
        ),
      ],
    );

    blocTest<LegalHoldBloc, LegalHoldState>(
      'handles backend failure during hold release gracefully',
      seed: () => LegalHoldState(holds: [sampleActiveHold]),
      build: () {
        when(() => mockRepository.releaseLegalHold(
              holdId: 'hold-101',
              releaseReason: 'Settled',
            )).thenThrow(ServerException('Database lock timeout'));
        return bloc;
      },
      act: (b) => b.add(const LegalHoldReleaseRequested(
        holdId: 'hold-101',
        releaseReason: 'Settled',
      )),
      expect: () => [
        LegalHoldState(holds: [sampleActiveHold], isSubmitting: true),
        LegalHoldState(
          isSubmitting: false,
          holds: [sampleActiveHold],
          errorMessage: 'Database lock timeout',
        ),
      ],
    );
  });
}
