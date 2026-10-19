import 'package:equatable/equatable.dart';

abstract class SessionEvent extends Equatable {
  const SessionEvent();

  @override
  List<Object?> get props => [];
}

class SessionsFetchRequested extends SessionEvent {
  const SessionsFetchRequested();
}

class SessionRevokeRequested extends SessionEvent {
  final String sessionId;

  const SessionRevokeRequested(this.sessionId);

  @override
  List<Object?> get props => [sessionId];
}
