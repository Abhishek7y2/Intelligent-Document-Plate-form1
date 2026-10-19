import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/legal_hold/domain/repositories/legal_hold_repository.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_bloc.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_event.dart';
import 'package:docunexa_mobile/features/legal_hold/presentation/bloc/legal_hold_state.dart';

class MockLegalHoldRepository extends Mock implements LegalHoldRepository {}

void main() {
  late MockLegalHoldRepository mockRepository;
  late LegalHoldBloc bloc;

  setUp(() {
    mockRepository = MockLegalHoldRepository();
    bloc = LegalHoldBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('LegalHoldBloc Hardening Tests (Duplicate Submission Prevention)', () {
    blocTest<LegalHoldBloc, LegalHoldState>(
      'ignores LegalHoldPlaceRequested when isSubmitting is already true',
      seed: () => const LegalHoldState(isSubmitting: true),
      build: () => bloc,
      act: (b) => b.add(const LegalHoldPlaceRequested(
        matterName: 'Investigation',
        matterNumber: 'MAT-1',
        reason: 'Subpoena',
      )),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.placeLegalHold(
              matterName: any(named: 'matterName'),
              matterNumber: any(named: 'matterNumber'),
              reason: any(named: 'reason'),
              scopeDocumentIds: any(named: 'scopeDocumentIds'),
              scopeDocumentType: any(named: 'scopeDocumentType'),
            ));
      },
    );

    blocTest<LegalHoldBloc, LegalHoldState>(
      'ignores LegalHoldReleaseRequested when isSubmitting is already true',
      seed: () => const LegalHoldState(isSubmitting: true),
      build: () => bloc,
      act: (b) => b.add(const LegalHoldReleaseRequested(
        holdId: 'hold-1',
        releaseReason: 'Settled',
      )),
      expect: () => [],
      verify: (_) {
        verifyNever(() => mockRepository.releaseLegalHold(
              holdId: any(named: 'holdId'),
              releaseReason: any(named: 'releaseReason'),
            ));
      },
    );
  });
}
