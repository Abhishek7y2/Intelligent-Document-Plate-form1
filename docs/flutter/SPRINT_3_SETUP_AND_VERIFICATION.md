# SPRINT 3 SETUP & VERIFICATION GUIDE — DOCUNEXA MOBILE
## Operations Dashboard, Document Discovery & Details Verification Runbook

**Document:** Sprint 3 Verification Runbook  
**Application Root:** `mobile/`  
**Target Environment:** CI Pipeline / Developer Workstation  
**Authoritative Date:** 2026-10-17  

---

## 1. Prerequisites

Ensure the following SDKs and runtime dependencies are available on the workstation or CI agent:
- **Flutter SDK:** `>= 3.16.0` (Dart SDK `>= 3.0.0 < 4.0.0`)
- **Android SDK:** API Level 26+ (Android 8.0+) or iOS SDK 15+
- **Backend API:** Node.js Express server running on port `8080` (`http://localhost:8080/api/v1`)
- **PostgreSQL Database:** Running and seeded with operational document data

---

## 2. Dependency Resolution & Code Quality

Run the following commands from the repository root:

```bash
# 1. Navigate to the mobile project root
cd mobile

# 2. Fetch and resolve package dependencies
flutter pub get

# 3. Verify Dart formatting compliance
dart format --set-exit-if-changed .

# 4. Run static lint and type analysis
flutter analyze
```

---

## 3. Automated Test Suite Execution

Execute the full automated test suite or target the Sprint 3 test suites individually:

```bash
# Run all mobile tests
flutter test

# Run Sprint 3 Dashboard test suites:
# 1. DashboardBloc State Transitions & Error Handling Tests
flutter test test/features/dashboard/presentation/bloc/dashboard_bloc_test.dart

# 2. DashboardScreen Widget & Responsive Layout Tests
flutter test test/features/dashboard/presentation/screens/dashboard_screen_test.dart

# Run Sprint 3 Document Catalog & Details test suites:
# 3. Document Repository DTO Mapping, Filter & Sort Tests
flutter test test/features/documents/data/repositories/document_repository_impl_test.dart

# 4. Document Catalog BLoC, Pagination & Duplicate Request Prevention Tests
flutter test test/features/documents/presentation/bloc/document_catalog_bloc_test.dart

# 5. Document Detail BLoC & Authorization Error Tests
flutter test test/features/documents/presentation/bloc/document_detail_bloc_test.dart

# 6. Document Catalog Screen Widget, Filter Chips & Card Tests
flutter test test/features/documents/presentation/screens/document_catalog_screen_test.dart

# 7. Document Detail Screen Header, SLA, Metadata & Hash Copy Tests
flutter test test/features/documents/presentation/screens/document_detail_screen_test.dart
```

---

## 4. Manual Verification Scenarios (Device / Simulator)

### Scenario A: Operations Dashboard Inspection
1. Launch the application on a connected device/emulator:
   ```bash
   flutter run
   ```
2. Authenticate with an analyst or reviewer account.
3. Observe the **Operations Dashboard** view:
   - Verify the greeting card displays the authenticated user's name, role, and tenant ID.
   - Verify the 2x2 KPI grid displays the Straight-Through Rate, Total Processed, Compliance Score, and Active Exceptions.
   - Verify the processing distribution bar reflects the correct status proportions (`APPROVED`, `NEEDS_REVIEW`, `PROCESSING`, `QUARANTINED`).
   - Trigger a pull-to-refresh gesture; verify the metrics refresh without UI jitter.
   - Tap "Document Catalog" under Quick Actions; verify immediate navigation to the Catalog tab.

### Scenario B: Document Catalog Search, Filter & Infinite Scroll
1. Navigate to the **Catalog** tab.
2. Confirm the initial page of documents loads with appropriate title, ID, document type badge, and confidence percentage.
3. Scroll toward the bottom of the list:
   - Verify the inline loading indicator appears during fetch.
   - Verify page 2 documents append smoothly to the list without resetting scroll position.
   - Verify rapid scrolling does not trigger duplicate API requests for the same page index.
4. Type a search query into the search box:
   - Verify instant filtering across titles and IDs.
   - Tap the clear icon (`x`); verify the search query resets and original results restore.
5. Tap status filter chips (e.g. `NEEDS_REVIEW`):
   - Verify only documents with the selected status remain visible.
   - Tap `ALL` to clear status filtering.
6. Open the Sort modal and choose "Highest Confidence":
   - Verify documents sort in descending confidence order.
7. Switch to the Dashboard tab and switch back to the Catalog tab:
   - Verify no redundant API refetch occurs and scroll position/filters are maintained.

### Scenario C: Document Details & Cryptographic Audit Inspection
1. From the Document Catalog list, tap any document card.
2. Verify smooth navigation to the detail route (`/documents/:id`).
3. Verify that the following sections render with accurate backend data:
   - Document title, file name, system ID, and extraction confidence score.
   - Processing SLA status card (`COMPLIANT`, `AT_RISK`, `BREACHED`).
   - File and ingestion metadata (file size, MIME type, page count, ingestion source).
   - Cryptographic SHA-256 digest in monospace font.
4. Tap the copy icon next to the SHA-256 hash:
   - Verify a confirmation snackbar appears ("SHA-256 hash copied to clipboard").
5. Disconnect network connectivity and trigger a refresh or navigate to an invalid ID:
   - Verify the `ErrorView` displays the error message, correlation ID, and an operational "Retry" button.

---

## 5. Troubleshooting & Contract Nuances

1. **Dashboard 403 Forbidden (`REPORT_GENERATE` Missing):**
   - If the backend user account lacks `REPORT_GENERATE` permission, `GET /api/v1/reports/kpis` returns HTTP 403.
   - `DashboardRemoteDataSource` catches this error and automatically calculates live aggregate metrics from `GET /api/v1/documents`, ensuring continuous mobile operations without administrative privileges.
2. **Infinite Pagination Loops:**
   - If `totalPages` returned by the backend equals `page`, `hasReachedMax` is set to `true`. Further scroll events are discarded.
3. **MFA Re-Authentication:**
   - As established in Sprint 2 analysis, entering a TOTP code during sign-in requires the full login credentials. Ensure `mfaCode` is supplied alongside the original password.
