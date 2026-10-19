import 'package:equatable/equatable.dart';

class UserSession extends Equatable {
  final String sessionId;
  final String ipAddress;
  final String userAgent;
  final String browser;
  final String os;
  final String createdAt;
  final String lastUsedAt;
  final bool isCurrent;

  const UserSession({
    required this.sessionId,
    required this.ipAddress,
    required this.userAgent,
    required this.browser,
    required this.os,
    required this.createdAt,
    required this.lastUsedAt,
    required this.isCurrent,
  });

  @override
  List<Object?> get props => [
        sessionId,
        ipAddress,
        userAgent,
        browser,
        os,
        createdAt,
        lastUsedAt,
        isCurrent,
      ];
}
