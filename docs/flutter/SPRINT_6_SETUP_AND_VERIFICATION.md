# SPRINT 6 SETUP AND VERIFICATION GUIDE: APPROVALS, SOD & VERSION COMPARISON

## Overview
This document specifies setup requirements, reproduction commands, and manual test procedures for DocuNexa Mobile Sprint 6.

---

## Toolchain & Execution Status (`BLK-001`)
- **Host OS:** Windows (PowerShell / Command Prompt)
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
Run all Sprint 6 test suites:
```bash
# Execute all approval tests
flutter test test/features/approvals/

# Execute all version compare tests
flutter test test/features/version_compare/

# Execute individual test suites
flutter test test/features/approvals/data/approval_remote_data_source_test.dart
flutter test test/features/approvals/presentation/bloc/approval_queue_bloc_test.dart
flutter test test/features/approvals/presentation/bloc/approval_detail_bloc_test.dart
flutter test test/features/approvals/presentation/screens/approvals_queue_screen_test.dart
flutter test test/features/approvals/presentation/screens/approval_detail_screen_test.dart
flutter test test/features/version_compare/presentation/bloc/version_compare_bloc_test.dart
flutter test test/features/version_compare/presentation/widgets/diff_chunk_viewer_test.dart
flutter test test/features/version_compare/presentation/screens/version_history_screen_test.dart
flutter test test/features/version_compare/presentation/screens/version_compare_screen_test.dart
```

### 4. Running the Application
Launch debug build on an active mobile emulator or connected device:
```bash
flutter run -d chrome  # or -d emulator-5554 / -d ios
```

---

## Manual Verification Steps

### Approvals Queue & Multi-Stage Quorum
1. Log in with an approver account (`DOC_APPROVE` permissions).
2. Tap the **Approvals** tab in the bottom navigation bar.
3. Verify that pending approval requests display:
   - Document Title and Type.
   - Tier Badge (`TIER 1`, `TIER 2`, `TIER 3`).
   - Monetary Amount.
   - Quorum Stage pill (`Stage 1/2`).
4. Filter by Tier chip (`Tier 2 ($10k-$50k)`) and confirm list filters correctly.

### Separation of Duties (SoD) Testing
1. Tap a document that was uploaded by the currently logged-in user.
2. Tap **Approve Stage** and confirm with a reason code.
3. Verify that the backend rejects the action with HTTP 403 `SOD_VIOLATION_SUBMITTER`.
4. Verify that [`SodViolationCard`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/mobile/lib/features/approvals/presentation/widgets/sod_violation_card.dart) appears with the policy explanation: *"You uploaded this document. Submitter cannot approve their own submission."*

### ERP Outbound Publishing
1. On a document where all required quorum sign-offs are completed (`approvedCount >= requiredApprovals`), verify that the **Enterprise ERP Integration** card is rendered.
2. Tap **Dispatch to ERP (Outbox)**.
3. Confirm that the dispatch state updates with idempotency key and publication timestamp.

### Document Version History & Version Comparison Studio
1. Open any document from the Document Catalog.
2. In the File Operations card, tap **Version History & Compare**.
3. Verify that all historical versions (`v1.0`, `v2.0`, etc.) are listed.
4. Select two versions using the checkboxes and tap **Compare Selected Versions**.
5. Inspect the **Version Comparison Studio**:
   - Header shows Baseline Version vs Compared Version.
   - Summary KPI pills show Total Clauses, High Risk, Modified, Added, Removed.
   - **Clauses Diff** tab renders cards with High/Medium/Low risk indicators and plain English impact.
   - Expanding a clause shows the unified word-level text diff with additions in light green and deletions in red strikethrough.
   - **Field Diffs** tab shows the before-and-after table of extracted fields.
