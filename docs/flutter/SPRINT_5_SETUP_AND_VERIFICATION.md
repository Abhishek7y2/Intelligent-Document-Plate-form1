# SPRINT 5 SETUP AND VERIFICATION GUIDE: OCR, EXTRACTION & REVIEW WORKBENCH

## Overview
This document specifies setup requirements, verification procedures, and reproduction commands for DocuNexa Mobile Sprint 5.

---

## Toolchain & Execution Status (`BLK-001`)
- **Host OS:** Windows (cmd / powershell)
- **Host Toolchain Check:** `flutter` command is not in the system environment PATH.
- **Execution Status:** `NOT_RUN` (No mock test passes claimed).
- All code has been authored to strict production Dart 3 and Flutter 3 specifications, following clean architecture and BLoC patterns.

---

## Verification & Execution Commands

### 1. Dependency Resolution
Run from the `mobile/` directory:
```bash
flutter pub get
```

### 2. Static Code Analysis
Run static analysis to verify zero type mismatches or lint warnings:
```bash
flutter analyze
```

### 3. Automated Test Execution
Run the full Sprint 5 test suite:
```bash
# Execute all review feature tests
flutter test test/features/review/

# Execute individual test suites
flutter test test/features/review/data/datasources/review_remote_data_source_test.dart
flutter test test/features/review/presentation/widgets/evidence_overlay_painter_test.dart
flutter test test/features/review/presentation/bloc/review_queue_bloc_test.dart
flutter test test/features/review/presentation/bloc/review_workbench_bloc_test.dart
flutter test test/features/review/presentation/screens/review_queue_screen_test.dart
flutter test test/features/review/presentation/screens/review_workbench_screen_test.dart
```

### 4. Running the Application
Launch debug build on an active mobile emulator or connected device:
```bash
flutter run -d chrome  # or -d emulator-5554 / -d ios
```

---

## Manual Verification Steps

### Review Queue
1. Log in with a reviewer account (`DOC_REVIEW` permissions).
2. Tap the **Review** icon in the bottom navigation bar.
3. Verify that the task list displays pending review tasks with title, document type, priority pill, SLA hours, and overall confidence percentage.
4. Filter by **High Priority** chip and confirm tasks filter appropriately.
5. Perform pull-to-refresh and verify queue reloads.

### Touch-Optimized Review Workbench
1. Tap any task from the queue to navigate to `/review/:docId`.
2. Inspect the split-screen view:
   - **Top 50%:** Document preview rendered from `/api/v1/documents/:id/pages/:pageNo/image`.
   - **Evidence Overlays:** Bounding boxes highlighted over OCR field locations.
   - **Pinch/Zoom:** Zoom and pan the document using `InteractiveViewer`; verify overlays scale in exact 1:1 sync with image dimensions without offset drift.
3. Test field selection:
   - Tap a field card in the lower panel.
   - Verify that the overlay painter shifts emphasis (thicker border, vibrant fill, floating label badge) to the matching bounding box.
   - If the bounding box is located on Page 2, verify the viewer automatically transitions pages.
4. Test field editing:
   - Tap the pencil icon on an extracted field card.
   - Input a corrected value and enter an audit reason.
   - Save correction and verify that the field value updates, triggering backend math re-evaluation.
5. Test math reconciliation & review submission:
   - Inspect the **Math Reconciliation Card** (`Net + Tax = Total`).
   - If balanced, verify that tapping **Approve** presents the confirmation dialog and submits `APPROVE`.
   - If mismatched, tap **Approve** and verify that an **Override Justification** is strictly required. Submitting without reason is blocked by the UI and rejected with HTTP 422 by the backend.
