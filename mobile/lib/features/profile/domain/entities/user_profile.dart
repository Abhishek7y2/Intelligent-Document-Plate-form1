import 'package:equatable/equatable.dart';

class UserProfile extends Equatable {
  final String userId;
  final String tenantId;
  final String firstName;
  final String lastName;
  final String preferredName;
  final String workEmail;
  final String phoneNumber;
  final String? dateOfBirth;
  final String employeeId;
  final String employmentStatus;
  final String designation;
  final String department;
  final String managerName;
  final String location;
  final String employeeType;
  final String dateJoined;
  final String role;
  final bool mfaEnabled;
  final String? lastLoginAt;
  final String? lastPasswordChangeAt;
  final String timezone;
  final String language;
  final bool emailAlerts;
  final bool inAppNotifications;
  final String? avatarUrl;
  final String? coverUrl;

  const UserProfile({
    required this.userId,
    required this.tenantId,
    required this.firstName,
    required this.lastName,
    required this.preferredName,
    required this.workEmail,
    required this.phoneNumber,
    this.dateOfBirth,
    required this.employeeId,
    required this.employmentStatus,
    required this.designation,
    required this.department,
    required this.managerName,
    required this.location,
    required this.employeeType,
    required this.dateJoined,
    required this.role,
    required this.mfaEnabled,
    this.lastLoginAt,
    this.lastPasswordChangeAt,
    required this.timezone,
    required this.language,
    required this.emailAlerts,
    required this.inAppNotifications,
    this.avatarUrl,
    this.coverUrl,
  });

  String get fullName => '$firstName $lastName'.trim();

  UserProfile copyWith({
    String? firstName,
    String? lastName,
    String? preferredName,
    String? phoneNumber,
    String? dateOfBirth,
    String? timezone,
    String? language,
    bool? emailAlerts,
    bool? inAppNotifications,
    String? avatarUrl,
  }) {
    return UserProfile(
      userId: userId,
      tenantId: tenantId,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      preferredName: preferredName ?? this.preferredName,
      workEmail: workEmail,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      employeeId: employeeId,
      employmentStatus: employmentStatus,
      designation: designation,
      department: department,
      managerName: managerName,
      location: location,
      employeeType: employeeType,
      dateJoined: dateJoined,
      role: role,
      mfaEnabled: mfaEnabled,
      lastLoginAt: lastLoginAt,
      lastPasswordChangeAt: lastPasswordChangeAt,
      timezone: timezone ?? this.timezone,
      language: language ?? this.language,
      emailAlerts: emailAlerts ?? this.emailAlerts,
      inAppNotifications: inAppNotifications ?? this.inAppNotifications,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      coverUrl: coverUrl,
    );
  }

  @override
  List<Object?> get props => [
        userId,
        tenantId,
        firstName,
        lastName,
        preferredName,
        workEmail,
        phoneNumber,
        dateOfBirth,
        employeeId,
        employmentStatus,
        designation,
        department,
        managerName,
        location,
        employeeType,
        dateJoined,
        role,
        mfaEnabled,
        lastLoginAt,
        lastPasswordChangeAt,
        timezone,
        language,
        emailAlerts,
        inAppNotifications,
        avatarUrl,
        coverUrl,
      ];
}
