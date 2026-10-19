import 'package:equatable/equatable.dart';

class RoleDetail extends Equatable {
  final String role;
  final String label;
  final bool canOverrideValidation;
  final String description;

  const RoleDetail({
    required this.role,
    required this.label,
    required this.canOverrideValidation,
    required this.description,
  });

  @override
  List<Object?> get props => [role, label, canOverrideValidation, description];
}

class UserInvitation extends Equatable {
  final String invitationId;
  final String email;
  final String role;
  final DateTime expiresAt;
  final String? inviteUrl;

  const UserInvitation({
    required this.invitationId,
    required this.email,
    required this.role,
    required this.expiresAt,
    this.inviteUrl,
  });

  bool get isExpired => expiresAt.isBefore(DateTime.now());

  @override
  List<Object?> get props => [invitationId, email, role, expiresAt, inviteUrl];
}
