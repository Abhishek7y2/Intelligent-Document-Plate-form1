# SPRINT 7 SETUP AND VERIFICATION GUIDE: TASKS, COLLABORATION, NOTIFICATIONS & GROUNDED Q&A

## 1. Overview
This guide provides workstation and CI verification procedures for DocuNexa Mobile Sprint 7 (`mobile-frontend` branch).

Features implemented:
- **Task Management & Collaboration (`/tasks`, `/tasks/:id`):** Filter by `mine`, `overdue`, `status`, and `priority`. Full status update workflow (`OPEN`, `IN_PROGRESS`, `COMPLETED`), assignment, due date warning, and immutable task collaboration thread (`/tasks/:id/comments`).
- **Notification Center (`/notifications`):** Filter by categories (`tasks`, `approvals`, `failures`, `expiry`, `general`), unread counter, optimistic mark-as-read, mark-all-as-read, and deep-link routing via `targetUrl`.
- **Evidence-Grounded Q&A (`/qa`):** Document focus scope picker (`/qa/documents`), grounded answer synthesis with confidence scores, source evidence citations with page number and text snippet, citation access verification (`/qa/citations/verify`), abstention banner for insufficient evidence, and user feedback submission (`/qa/traces/:traceId/feedback`).

---

## 2. Prerequisites
- **Flutter SDK:** Flutter 3.22.x or later (Channel stable)
- **Dart SDK:** 3.4.x or later
- **Backend Service:** Running at `http://localhost:3000/api/v1` (or configured via `--dart-define=API_BASE_URL=...`)

---

## 3. Workstation & CI Verification Commands

### Step 1: Dependency Resolution
```powershell
cd mobile
flutter pub get
```

### Step 2: Static Analysis & Formatting
```powershell
dart format --output=none --set-exit-if-changed .
flutter analyze
```

### Step 3: Run Sprint 7 Automated Tests
```powershell
# Run QA BLoC & Screen tests
flutter test test/features/qa/presentation/bloc/qa_bloc_test.dart
flutter test test/features/qa/presentation/screens/qa_screen_test.dart

# Run Notifications BLoC & Screen tests
flutter test test/features/notifications/presentation/bloc/notification_bloc_test.dart
flutter test test/features/notifications/presentation/screens/notification_center_screen_test.dart

# Run Tasks BLoC & Screen tests
flutter test test/features/tasks/presentation/bloc/task_bloc_test.dart
flutter test test/features/tasks/presentation/screens/tasks_screen_test.dart

# Run all test suites
flutter test
```

### Step 4: Launching Debug Build
```powershell
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

---

## 4. Manual Verification Scenarios

### Scenario A: Grounded Q&A with Citation Verification
1. Open the app and navigate to **Operations Dashboard**.
2. Tap the **Grounded Document Q&A** button.
3. Tap **Scope** at the top; select a document (e.g. Master Services Agreement).
4. Enter question: "What is the payment term?".
5. Verify response renders:
   - Confidence percentage badge (e.g. 95% Grounded).
   - Answer text citing Net 30 days.
   - Evidence Citation card displaying document title, page number (p. 4), and quotation snippet.
   - Tap **Verify Access**; verify snackbar confirms authorized tenant access.
   - Tap the Thumbs Up icon; verify feedback is recorded for the trace ID.

### Scenario B: Task Creation & Collaboration Comments
1. From the dashboard or navigation, navigate to **Team Tasks & Collaboration** (`/tasks`).
2. Tap the `+` FAB; enter task title "Review Invoice line items" and select priority "High". Tap **Create Task**.
3. Verify new task appears at top of the list with HIGH badge and OPEN status.
4. Tap the task to open **Task Details** (`/tasks/:id`).
5. Tap **Start Work**; verify status changes to IN PROGRESS.
6. In the bottom comment box, type "Checking line item 3 against purchase order" and tap Send.
7. Verify comment appears in the collaboration thread with author initials and timestamp.

### Scenario C: Notification Center & Deep-Link Navigation
1. On the dashboard, tap the **Notification Bell** icon in the app bar.
2. Verify notifications are categorized with filter chips (All, Tasks, Approvals, Alerts, Retention).
3. Tap **Unread (X)** chip; verify only unread notifications display.
4. Tap an unread notification with a deep-link target (e.g., an approval notification targeting `/approvals/:id`); verify the notification is marked read and navigates directly to the approval detail screen.
5. Tap **Mark all read**; verify all unread badges clear.

---

## 5. Toolchain Execution Status
- Current Environment Status: `NOT_RUN` due to `BLK-001` (Windows host does not have Flutter binary in PATH).
- Authored code is verified statically against verified contracts and production design tokens.
