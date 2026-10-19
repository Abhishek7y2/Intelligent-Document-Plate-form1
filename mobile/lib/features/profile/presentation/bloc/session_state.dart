import 'package:equatable/equatable.dart';
import '../../domain/entities/user_session.dart';

abstract class SessionState extends Equatable {
  const SessionState();

  @override
  List<Object?> get props => [];
}

class SessionInitial extends SessionState {
  const SessionInitial();
}

class SessionLoading extends SessionState {
  const SessionLoading();
}

class SessionLoaded extends SessionState {
  final List<UserSession> sessions;

  const SessionLoaded(this.sessions);

  @override
  List<Object?> get props => [sessions];
}

class SessionError extends SessionState {
  final String message;
  final String? correlationId;

  const SessionError({required this.message, this.correlationId});

  @override
  List<Object?> get props => [message, correlationId];
}

class SessionRevokedSuccess extends SessionState {
  final String message;

  const SessionRevokedSuccess(this.message);

  @override
  List<Object?> get props => [message];
}
