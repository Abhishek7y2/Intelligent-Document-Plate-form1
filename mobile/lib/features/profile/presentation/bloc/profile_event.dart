import 'package:equatable/equatable.dart';

abstract class ProfileEvent extends Equatable {
  const ProfileEvent();

  @override
  List<Object?> get props => [];
}

class ProfileFetchRequested extends ProfileEvent {
  const ProfileFetchRequested();
}

class ProfileUpdateSubmitted extends ProfileEvent {
  final String? firstName;
  final String? lastName;
  final String? preferredName;
  final String? phoneNumber;
  final String? dateOfBirth;
  final String? timezone;
  final String? language;
  final bool? emailAlerts;
  final bool? inAppNotifications;

  const ProfileUpdateSubmitted({
    this.firstName,
    this.lastName,
    this.preferredName,
    this.phoneNumber,
    this.dateOfBirth,
    this.timezone,
    this.language,
    this.emailAlerts,
    this.inAppNotifications,
  });

  @override
  List<Object?> get props => [
        firstName,
        lastName,
        preferredName,
        phoneNumber,
        dateOfBirth,
        timezone,
        language,
        emailAlerts,
        inAppNotifications,
      ];
}

class AvatarUploadSubmitted extends ProfileEvent {
  final List<int> fileBytes;
  final String filename;
  final String mimeType;

  const AvatarUploadSubmitted({
    required this.fileBytes,
    required this.filename,
    required this.mimeType,
  });

  @override
  List<Object?> get props => [fileBytes, filename, mimeType];
}
