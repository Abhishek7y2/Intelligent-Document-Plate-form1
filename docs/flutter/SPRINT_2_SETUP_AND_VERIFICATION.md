# SPRINT 2 SETUP & VERIFICATION GUIDE — DOCUNEXA MOBILE
## Authentication, Sessions, Biometrics & Profile Verification Runbook

**Document:** Sprint 2 Verification Runbook  
**Application Root:** `mobile/`  
**Target Environment:** CI Pipeline / Developer Workstation  
**Authoritative Date:** 2026-10-17  

---

## 1. Prerequisites

Ensure the following SDKs are installed on the workstation or CI agent:
- **Flutter SDK:** `>= 3.16.0` (Dart SDK `>= 3.0.0 < 4.0.0`)
- **Android SDK:** API Level 26+ (Android 8.0+)
- **Backend API:** Node.js Express server running on port `8080` (`http://localhost:8080/api/v1`)
- **PostgreSQL:** Running on port `5433` (or local fallback store active)

---

## 2. Dependency Resolution & Code Quality

Run the following commands from the repository root:

```bash
# 1. Navigate to mobile directory
cd mobile

# 2. Fetch and resolve package dependencies (including flutter_secure_storage and local_auth)
flutter pub get

# 3. Check code formatting compliance
dart format --set-exit-if-changed .

# 4. Run static analysis and lint inspection
flutter analyze
```

---

## 3. Automated Test Suite Execution

Execute the full Sprint 2 unit, BLoC, and widget test suites:

```bash
# Run all tests
flutter test

# Run focused Sprint 2 test suites individually:

# 1. Hardware Keystore Persistence Tests
flutter test test/core/storage/secure_storage_service_test.dart

# 2. Biometric Service Cancellation & Hardware Fallback Tests
flutter test test/core/biometrics/biometric_service_test.dart

# 3. Dio Queued Token Refresh Concurrency & Loop Prevention Tests
flutter test test/core/network/auth_interceptor_test.dart

# 4. Authentication State Machine (BLoC) Tests
flutter test test/features/auth/presentation/bloc/auth_bloc_test.dart

# 5. Login & MFA Form Validation Widget Tests
flutter test test/features/auth/presentation/screens/login_screen_test.dart

# 6. User Profile Fetch & Update BLoC Tests
flutter test test/features/profile/presentation/bloc/profile_bloc_test.dart

# 7. Active Session Auditing & Revocation BLoC Tests
flutter test test/features/profile/presentation/bloc/session_bloc_test.dart
```

---

## 4. Local Execution & Backend Integration

To run the mobile application against the local DocuNexa backend:

### Android Emulator (Automatic host loopback 10.0.2.2)
```bash
cd mobile
flutter run \
  --dart-define=ENV=development \
  --dart-define=API_HOST=10.0.2.2 \
  --dart-define=API_PORT=8080
```

### Physical Android Device or iOS Simulator (LAN IP)
```bash
cd mobile
flutter run \
  --dart-define=ENV=development \
  --dart-define=API_HOST=192.168.1.xxx \
  --dart-define=API_PORT=8080
```

---

## 5. Platform Native Configuration Notes

### Android (`android/app/src/main/AndroidManifest.xml`)
The `local_auth` plugin requires the `USE_BIOMETRIC` permission. Ensure `android/app/src/main/AndroidManifest.xml` includes:
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC"/>
```
And make sure `MainActivity` extends `FlutterFragmentActivity` instead of `FlutterActivity` to support biometric prompt dialogs:
```kotlin
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity: FlutterFragmentActivity() {
}
```

### iOS (`ios/Runner/Info.plist`)
For Face ID support on iOS devices, include the usage description key in `ios/Runner/Info.plist`:
```xml
<key>NSFaceIDUsageDescription</key>
<string>DocuNexa requires biometric authentication to securely unlock your active document session.</string>
```

---

## 6. Verification Status

| Check | Environment | Execution Status | Evidence Reference |
| :--- | :--- | :---: | :--- |
| `flutter pub get` | Local Host (Windows) | `NOT_RUN` | Blocked by [`BLK-001`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/audit/DECISIONS_AND_BLOCKERS.md#L28) |
| `flutter analyze` | Local Host (Windows) | `NOT_RUN` | Blocked by [`BLK-001`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/audit/DECISIONS_AND_BLOCKERS.md#L28) |
| `flutter test` | Local Host (Windows) | `NOT_RUN` | Blocked by [`BLK-001`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docs/audit/DECISIONS_AND_BLOCKERS.md#L28) |
| Static Syntax & Regex | Local Host (Windows) | **PASS** | Verified via static AST/file system inspection |
