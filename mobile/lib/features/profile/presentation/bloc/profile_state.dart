import 'package:equatable/equatable.dart';
import '../../domain/entities/user_profile.dart';

abstract class ProfileState extends Equatable {
  const ProfileState();

  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {
  const ProfileInitial();
}

class ProfileLoading extends ProfileState {
  const ProfileLoading();
}

class ProfileLoaded extends ProfileState {
  final UserProfile profile;

  const ProfileLoaded(this.profile);

  @override
  List<Object?> get props => [profile];
}

class ProfileUpdating extends ProfileState {
  final UserProfile currentProfile;

  const ProfileUpdating(this.currentProfile);

  @override
  List<Object?> get props => [currentProfile];
}

class ProfileError extends ProfileState {
  final String message;
  final String? correlationId;
  final UserProfile? currentProfile;

  const ProfileError({
    required this.message,
    this.correlationId,
    this.currentProfile,
  });

  @override
  List<Object?> get props => [message, correlationId, currentProfile];
}
