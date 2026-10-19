import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String userId;
  final String email;
  final String tenantId;
  final String fullName;
  final String role;
  final List<String> permissions;

  const User({
    required this.userId,
    required this.email,
    required this.tenantId,
    required this.fullName,
    required this.role,
    this.permissions = const [],
  });

  @override
  List<Object?> get props => [userId, email, tenantId, fullName, role, permissions];
}
