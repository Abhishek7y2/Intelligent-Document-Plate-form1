# SPRINT 1 — SETUP AND VERIFICATION RUNBOOK

**Application:** DocuNexa Mobile Client (`mobile/`)  
**Target Environment:** Local Workstation / CI Runner with Flutter 3.16+ & Dart 3.0+  
**Operating Systems Supported:** Windows, macOS, Linux  
**Date:** 2026-10-16  

---

## 1. Prerequisites & Toolchain Setup

To compile and verify DocuNexa Mobile on a developer workstation or continuous integration server, ensure the following tooling is installed:

1. **Flutter SDK:** Version `3.16.0` or higher (`stable` channel).
   ```bash
   flutter --version
   ```
2. **Dart SDK:** Version `3.0.0` or higher (bundled with Flutter).
3. **Android Toolchain (for Android builds):**
   - Android Studio / Command-line Tools (JDK 17).
   - Android SDK Platform `android-34` or `android-35`.
   - Android Virtual Device (AVD) running API Level 26+.
4. **Xcode (for iOS builds, macOS only):**
   - Xcode 15+ and CocoaPods (`pod --version`).

---

## 2. Dependency Installation & Verification Commands

Navigate to the `mobile/` directory and execute the following commands:

### Step 1: Install Dependencies
```bash
cd mobile
flutter pub get
```

### Step 2: Static Analysis & Code Quality Checks
Verify that all source code complies with strict enterprise lints and zero analysis warnings:
```bash
flutter analyze
```
*Expected Result:* `No issues found!` (0 errors, 0 warnings).

### Step 3: Execute Automated Unit & Widget Tests
Run the complete test suite verifying design tokens, logging redaction, routing, and UI components:
```bash
flutter test --coverage
```
*Expected Result:* All test suites pass (100% assertions satisfied).

### Step 4: Verify Test Coverage
Generate the HTML coverage report from the LCOV trace:
```bash
# On systems with lcov installed:
genhtml coverage/lcov.info -o coverage/html
```

---

## 3. Running the Application Locally

### Running in Development Flavor (Connecting to Local Backend on 8080)
Ensure the DocuNexa backend API server is running on port 8080:
```bash
# For Android Emulator (uses 10.0.2.2 loopback):
flutter run -d emulator-5554 --dart-define=ENV=development --dart-define=API_HOST=10.0.2.2 --dart-define=API_PORT=8080

# For iOS Simulator / Web:
flutter run -d iPhone --dart-define=ENV=development --dart-define=API_HOST=localhost --dart-define=API_PORT=8080
```

### Running in Staging Flavor
```bash
flutter run --dart-define=ENV=staging
```

### Running in Production Flavor
```bash
flutter run --dart-define=ENV=production
```

---

## 4. Verification Checkpoint Status

| Check | Tool / Command | Local Host Status | Target Environment |
| :--- | :--- | :---: | :--- |
| **Dependency Resolution** | `flutter pub get` | **`NOT_RUN`** | CI Runner / Workstation with Flutter SDK |
| **Static Code Analysis** | `flutter analyze` | **`NOT_RUN`** | CI Runner / Workstation with Flutter SDK |
| **Automated Unit Tests** | `flutter test` | **`NOT_RUN`** | CI Runner / Workstation with Flutter SDK |
| **Clean Architecture Structure** | Source Tree Audit | **`VERIFIED`** | Source files verified in `mobile/` |
| **Zero Secret Exposure** | Regex Source Scan | **`VERIFIED`** | Zero credentials or secrets in repo |
