import '../entities/user_profile.dart';
import '../entities/user_session.dart';

abstract class ProfileRepository {
  Future<UserProfile> getProfile();

  Future<UserProfile> updateProfile({
    String? firstName,
    String? lastName,
    String? preferredName,
    String? phoneNumber,
    String? dateOfBirth,
    String? timezone,
    String? language,
    bool? emailAlerts,
    bool? inAppNotifications,
  });

  Future<String> uploadAvatar({
    required List<int> fileBytes,
    required String filename,
    required String mimeType,
  });

  Future<List<UserSession>> listSessions();

  Future<void> revokeSession(String sessionId);
}
