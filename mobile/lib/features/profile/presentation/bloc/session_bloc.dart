import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/repositories/profile_repository.dart';
import 'session_event.dart';
import 'session_state.dart';

class SessionBloc extends Bloc<SessionEvent, SessionState> {
  final ProfileRepository _profileRepository;

  SessionBloc({required ProfileRepository profileRepository})
      : _profileRepository = profileRepository,
        super(const SessionInitial()) {
    on<SessionsFetchRequested>(_onSessionsFetchRequested);
    on<SessionRevokeRequested>(_onSessionRevokeRequested);
  }

  Future<void> _onSessionsFetchRequested(
    SessionsFetchRequested event,
    Emitter<SessionState> emit,
  ) async {
    emit(const SessionLoading());
    try {
      final sessions = await _profileRepository.listSessions();
      emit(SessionLoaded(sessions));
    } on ApiException catch (e) {
      emit(SessionError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(SessionError(message: e.toString()));
    }
  }

  Future<void> _onSessionRevokeRequested(
    SessionRevokeRequested event,
    Emitter<SessionState> emit,
  ) async {
    try {
      await _profileRepository.revokeSession(event.sessionId);
      emit(const SessionRevokedSuccess('Session successfully revoked.'));
      // Reload sessions
      final sessions = await _profileRepository.listSessions();
      emit(SessionLoaded(sessions));
    } on ApiException catch (e) {
      emit(SessionError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(SessionError(message: e.toString()));
    }
  }
}
