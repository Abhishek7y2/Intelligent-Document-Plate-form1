import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/repositories/profile_repository.dart';
import 'profile_event.dart';
import 'profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final ProfileRepository _profileRepository;

  ProfileBloc({required ProfileRepository profileRepository})
      : _profileRepository = profileRepository,
        super(const ProfileInitial()) {
    on<ProfileFetchRequested>(_onProfileFetchRequested);
    on<ProfileUpdateSubmitted>(_onProfileUpdateSubmitted);
    on<AvatarUploadSubmitted>(_onAvatarUploadSubmitted);
  }

  Future<void> _onProfileFetchRequested(
    ProfileFetchRequested event,
    Emitter<ProfileState> emit,
  ) async {
    emit(const ProfileLoading());
    try {
      final profile = await _profileRepository.getProfile();
      emit(ProfileLoaded(profile));
    } on ApiException catch (e) {
      emit(ProfileError(
        message: e.message,
        correlationId: e.correlationId,
      ));
    } catch (e) {
      emit(ProfileError(message: e.toString()));
    }
  }

  Future<void> _onProfileUpdateSubmitted(
    ProfileUpdateSubmitted event,
    Emitter<ProfileState> emit,
  ) async {
    UserProfile? currentProfile;
    if (state is ProfileLoaded) {
      currentProfile = (state as ProfileLoaded).profile;
      emit(ProfileUpdating(currentProfile));
    }

    try {
      final updatedProfile = await _profileRepository.updateProfile(
        firstName: event.firstName,
        lastName: event.lastName,
        preferredName: event.preferredName,
        phoneNumber: event.phoneNumber,
        dateOfBirth: event.dateOfBirth,
        timezone: event.timezone,
        language: event.language,
        emailAlerts: event.emailAlerts,
        inAppNotifications: event.inAppNotifications,
      );
      emit(ProfileLoaded(updatedProfile));
    } on ApiException catch (e) {
      emit(ProfileError(
        message: e.message,
        correlationId: e.correlationId,
        currentProfile: currentProfile,
      ));
      if (currentProfile != null) {
        emit(ProfileLoaded(currentProfile));
      }
    } catch (e) {
      emit(ProfileError(
        message: e.toString(),
        currentProfile: currentProfile,
      ));
      if (currentProfile != null) {
        emit(ProfileLoaded(currentProfile));
      }
    }
  }

  Future<void> _onAvatarUploadSubmitted(
    AvatarUploadSubmitted event,
    Emitter<ProfileState> emit,
  ) async {
    UserProfile? currentProfile;
    if (state is ProfileLoaded) {
      currentProfile = (state as ProfileLoaded).profile;
      emit(ProfileUpdating(currentProfile));
    }

    try {
      final avatarUrl = await _profileRepository.uploadAvatar(
        fileBytes: event.fileBytes,
        filename: event.filename,
        mimeType: event.mimeType,
      );

      if (currentProfile != null) {
        final updatedProfile = currentProfile.copyWith(avatarUrl: avatarUrl);
        emit(ProfileLoaded(updatedProfile));
      } else {
        add(const ProfileFetchRequested());
      }
    } on ApiException catch (e) {
      emit(ProfileError(
        message: e.message,
        correlationId: e.correlationId,
        currentProfile: currentProfile,
      ));
      if (currentProfile != null) {
        emit(ProfileLoaded(currentProfile));
      }
    } catch (e) {
      emit(ProfileError(
        message: e.toString(),
        currentProfile: currentProfile,
      ));
      if (currentProfile != null) {
        emit(ProfileLoaded(currentProfile));
      }
    }
  }
}
