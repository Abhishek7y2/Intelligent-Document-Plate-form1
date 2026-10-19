# SPRINT 4 SETUP & VERIFICATION GUIDE — DOCUNEXA MOBILE
## Secure Document Intake, Native Scanner, Upload & File Operations Runbook

**Document:** Sprint 4 Verification Runbook  
**Application Root:** `mobile/`  
**Target Environment:** CI Pipeline / Developer Workstation  
**Authoritative Date:** 2026-10-17  

---

## 1. Prerequisites

Ensure the following SDKs and runtime dependencies are available on the workstation or CI agent:
- **Flutter SDK:** `>= 3.16.0` (Dart SDK `>= 3.0.0 < 4.0.0`)
- **Android SDK:** API Level 26+ (Android 8.0+) with Camera Hardware or Emulator Virtual Camera
- **iOS SDK:** iOS 15+ with Camera Usage Description in `Info.plist`
- **Backend API:** Node.js Express server running on port `8080` (`http://localhost:8080/api/v1`)
- **PostgreSQL Database:** Running with `intake_documents` and `audit_trail_events` tables

---

## 2. Dependency Resolution & Code Quality

Run the following commands from the repository root:

```bash
# 1. Navigate to the mobile project root
cd mobile

# 2. Fetch and resolve package dependencies (including cunning_document_scanner and file_picker)
flutter pub get

# 3. Check code formatting compliance
dart format --set-exit-if-changed .

# 4. Run static lint and type analysis
flutter analyze
```

---

## 3. Automated Test Suite Execution

Execute the full automated test suite or target the Sprint 4 test suites individually:

```bash
# Run all mobile tests
flutter test

# Run Sprint 4 Intake & Upload test suites:
# 1. Pre-validation, Magic Bytes & Sanitization Tests (11 tests)
flutter test test/features/intake/data/services/file_validation_helper_test.dart

# 2. Multipart Upload, Idempotency & Error Mapping Tests (5 tests)
flutter test test/features/intake/data/datasources/intake_remote_data_source_test.dart

# 3. Intake Repository Coordination & Validation Tests (8 tests)
flutter test test/features/intake/data/repositories/intake_repository_impl_test.dart

# 4. Intake State Machine, Progress, Concurrency & Cancellation Tests (11 tests)
flutter test test/features/intake/presentation/bloc/intake_bloc_test.dart

# 5. Intake Screen Widget, Preview, Progress & Conflict Tests (7 tests)
flutter test test/features/intake/presentation/screens/intake_screen_test.dart
```

---

## 4. Manual Verification Scenarios (Device / Simulator)

### Scenario A: Camera Scanner Document Ingestion
1. Launch the application on a connected device/emulator:
   ```bash
   flutter run
   ```
2. Authenticate with a reviewer account with `DOC_UPLOAD` permission.
3. Tap the floating action button (`+` scanner icon) from any shell tab to navigate to `/intake`.
4. Tap **Camera Document Scanner**:
   - Verify camera permission prompt appears on initial launch.
   - Accept permission; verify native document scanner camera interface opens.
   - Align camera with a physical document; verify automatic edge detection activates.
   - Capture a page; verify perspective crop is applied.
   - Accept the scan; verify return to the **Document Ready** preview card in DocuNexa Mobile.
5. Select document classification type (e.g. `Purchase Invoice`).
6. Tap **Start Secure Upload**:
   - Verify upload progress screen displays percentage and transmitted byte counters.
   - Verify successful transition to the **Ingestion Successful** screen with assigned `documentId`.
   - Tap **View in Document Catalog**; verify immediate navigation to `/documents/:id`.

### Scenario B: Digital File Picking & Format Pre-validation
1. Navigate to `/intake` and tap **Digital File Storage**.
2. Select a valid PDF document (under 50 MB):
   - Verify document name, formatted size, and pre-upload integrity check badge render.
3. Attempt to pick an unsupported file type (e.g., `.exe` or `.zip`):
   - Verify file picker restricts file selection, or pre-validation halts upload with an actionable error banner.
4. Attempt to pick an empty (0-byte) file:
   - Verify pre-validation halts upload ("Selected file is empty (0 bytes)").

### Scenario C: Duplicate Document Collision Resolution
1. Upload a document that has already been ingested into the tenant.
2. Observe backend response:
   - Verify upload transitions to the **Duplicate Document Detected** warning card.
   - Verify `existingDocumentId` is displayed.
3. Tap **Force Ingest Anyway**:
   - Verify the request re-submits with `allowDuplicate=true`.
   - Verify successful ingestion response.

### Scenario D: Upload Cancellation
1. Select a larger document (10–20 MB) on a throttled cellular connection.
2. Tap **Start Secure Upload**.
3. While progress bar is advancing, tap **Cancel Upload**:
   - Verify the HTTP request terminates immediately via `CancelToken`.
   - Verify the app returns cleanly to the Document Ready preview card without hanging or crashing.

### Scenario E: Document Page Preview Operation
1. From the Document Catalog, select any ingested document to open Document Details (`/documents/:id`).
2. Scroll to the **Secure File Operations** card.
3. Tap **Preview Document Pages**:
   - Verify the page preview dialog opens.
   - Verify the high-resolution server-rendered raster page loads via `/documents/:id/pages/1/image`.
   - Verify note explaining raw binary download policy.

---

## 5. Troubleshooting & Contract Nuances

1. **Upload Rate Limiting (HTTP 429):**
   - The backend applies `uploadRateLimiter` to `/documents/upload`. If multiple rapid uploads occur in automated test scripts, wait for the rate limit window to reset.
2. **Idempotency Replay (HTTP 200 with `Idempotent-Replay: true`):**
   - If an upload request with identical `Idempotency-Key` and file payload is received, the backend returns the cached ingestion record rather than re-inserting.
3. **Malware Quarantine (HTTP 422):**
   - If a test file contains an EICAR test string, the server quarantine engine rejects the file with HTTP 422 `MALWARE_DETECTED`. The mobile UI safely displays the security threat without attempting automatic retries.
4. **Missing Raw Binary Download:**
   - Raw binary downloads are not exposed on the backend REST API. The verified viewing mechanism is server-rendered page rasters (`/documents/:id/pages/:pageNo/image`).
