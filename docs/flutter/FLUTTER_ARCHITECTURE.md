# FLUTTER MOBILE ARCHITECTURE BLUEPRINT — DOCUNEXA PLATFORM

**Target Application:** DocuNexa Mobile Client  
**Platform Target:** Android First (API 26+), iOS Ready (iOS 15+)  
**Framework & Language:** Flutter (Dart 3.x)  
**Architecture Pattern:** Feature-First Clean Architecture with BLoC State Management  
**Active Git Branch:** `mobile-frontend`  
**Authoritative Baseline:** Sprint 0A–0E Verification Reports  
**Date:** 2026-10-16  
**Auditor:** Principal Software Architect & Senior Flutter Engineer  

---

## 1. Architectural Principles & High-Level Topology

DocuNexa Mobile delivers an enterprise-grade document intelligence client designed for high productivity, operational resilience, and touch-first interactions. It translates wide-screen desktop web capabilities into mobile workflows without compromising multi-tenant data boundaries, authorization rules, or API contracts.

### Core Architectural Axioms
1. **Unidirectional Data Flow:** Presentation emits Events -> BLoC processes business logic -> Emits immutable States -> UI renders state reactively.
2. **Backend as Source of Truth:** All business validations, authorization, document state transitions, and role permissions are authoritative on the backend. The mobile client never assumes or elevates roles locally.
3. **Strict Separation of Concerns:** UI widgets never make direct HTTP requests, access databases, or parse raw JSON. All communication routes through type-safe repositories and data sources.
4. **Resilient Session Management:** Automatic, synchronized token refresh queue in `Dio` eliminating session dropouts (resolving `DEF-011` / `SEC-009`).
5. **Zero Client-Side Security Bypasses:** Elimination of web demo role switchers (`DEF-010`) and local password length checks (`DEF-009`).

```mermaid
graph TD
    subgraph Presentation ["Presentation Layer (Feature-Scoped)"]
        UI[UI Widgets & Screens]
        BLoC[BLoC / Cubit State Managers]
    end

    subgraph Domain ["Domain Layer (Platform Agnostic)"]
        Entities[Domain Entities]
        UseCases[Use Cases / Business Logic]
        RepoInterfaces[Repository Interfaces]
    end

    subgraph Data ["Data Layer (Infrastructure)"]
        RepoImpl[Repository Implementations]
        RemoteDS[Remote REST Data Source (Dio)]
        LocalDS[Local Cache (Drift / SQLite)]
        SecureStore[Secure Storage (Keystore / Keychain)]
    end

    subgraph External ["External Services"]
        BackendAPI["Node.js Express API (/api/v1)"]
        Hardware["Device Camera / Biometrics"]
    end

    UI -->|Dispatches Events| BLoC
    BLoC -->|Emits States| UI
    BLoC -->|Executes| UseCases
    UseCases -->|Invokes| RepoInterfaces
    RepoImpl -.->|Implements| RepoInterfaces
    RepoImpl -->|Queries/Mutates| RemoteDS
    RepoImpl -->|Caches| LocalDS
    RemoteDS -->|Reads/Writes Tokens| SecureStore
    RemoteDS -->|HTTPS / REST| BackendAPI
    UI -->|Native Channels| Hardware
```

---

## 2. Layered Directory & Module Structure

The mobile codebase utilizes a **Feature-First** structure. Cross-cutting utilities, theme definitions, network clients, and shared widgets reside in `core/`, while business capabilities are partitioned into self-contained feature slices under `features/`.

```
lib/
├── app.dart                                # MaterialApp entrypoint, theme injection, top-level blocs
├── main_development.dart                  # Dev environment entrypoint (localhost/staging)
├── main_production.dart                   # Prod environment entrypoint (production gateway)
├── core/                                  # Cross-cutting platform layer
│   ├── config/                            # Environment variables, constants, flavor configs
│   │   ├── env_config.dart
│   │   └── api_endpoints.dart             # Canonical backend routes
│   ├── di/                                # Dependency injection setup (GetIt)
│   │   └── injection_container.dart
│   ├── network/                           # Dio HTTP client, interceptors, error models
│   │   ├── api_client.dart
│   │   ├── auth_interceptor.dart          # Synced token refresh queue
│   │   ├── correlation_interceptor.dart   # x-correlation-id generator
│   │   ├── error_handler.dart             # RFC 7807 Problem Details mapping
│   │   └── network_info.dart              # Connectivity checker
│   ├── router/                            # GoRouter declarative navigation & role guards
│   │   ├── app_router.dart
│   │   └── route_guards.dart
│   ├── storage/                           # Secure credentials and local database
│   │   ├── secure_storage_service.dart    # flutter_secure_storage wrapper
│   │   └── local_database.dart            # drift / sqlite schema
│   ├── theme/                             # Design system, colors, typography, styles
│   │   ├── app_colors.dart                # Deep Indigo, Slate Dark Mode, Emerald, Amber, Rose
│   │   ├── app_typography.dart            # GoogleFonts Inter scale
│   │   └── app_theme.dart                 # Material 3 ThemeData (Light & Dark)
│   └── widgets/                           # Reusable enterprise UI components
│       ├── app_button.dart
│       ├── app_text_field.dart
│       ├── status_badge.dart
│       ├── shimmer_loader.dart
│       └── error_view.dart
└── features/                              # Encapsulated business features
    ├── auth/                              # Authentication, MFA, Onboarding
    │   ├── data/
    │   │   ├── datasources/auth_remote_data_source.dart
    │   │   ├── models/auth_tokens_model.dart
    │   │   └── repositories/auth_repository_impl.dart
    │   ├── domain/
    │   │   ├── entities/user.dart
    │   │   └── repositories/auth_repository.dart
    │   └── presentation/
    │       ├── blocs/auth/auth_bloc.dart
    │       ├── screens/login_screen.dart
    │       ├── screens/verify_email_screen.dart
    │       ├── screens/reset_password_screen.dart
    │       └── screens/accept_invite_screen.dart
    ├── dashboard/                         # Executive & Operational Dashboard (Tab 0)
    ├── documents/                         # Document Catalog & Details (Tab 1)
    ├── intake/                            # Camera Ingestion & File Upload (FAB)
    ├── review/                            # Review Queue & Coordinate Workbench (Tab 2)
    ├── approvals/                         # Approvals Queue & SoD Verification (Tab 3)
    ├── profile/                           # User Profile, Sessions & Biometrics (Tab 4)
    ├── search/                            # Hybrid Search & Grounded Q&A Chat
    ├── compare/                           # Document Version Comparison Studio
    ├── tasks/                             # Task Management & Assignments
    ├── reports/                           # Analytics & Metrics (fl_chart)
    └── admin/                             # Telemetry, User Directory, Retention Governance
```

---

## 3. Dependency Injection & Service Registration (`GetIt`)

All dependencies are wired via `GetIt` in `lib/core/di/injection_container.dart` using lazy singletons for stateless services and factories for BLoCs to ensure proper lifecycle cleanup.

```dart
// Core Services
sl.registerLazySingleton<FlutterSecureStorage>(() => const FlutterSecureStorage());
sl.registerLazySingleton<SecureStorageService>(() => SecureStorageServiceImpl(sl()));
sl.registerLazySingleton<Dio>(() => createDioClient(sl()));
sl.registerLazySingleton<ApiClient>(() => ApiClientImpl(sl()));

// Repositories
sl.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl(remoteDataSource: sl(), secureStorage: sl()));
sl.registerLazySingleton<DocumentRepository>(() => DocumentRepositoryImpl(remoteDataSource: sl(), localCache: sl()));

// BLoCs (Factory - fresh instance per screen/flow)
sl.registerFactory(() => AuthBloc(authRepository: sl(), secureStorage: sl()));
sl.registerFactory(() => DocumentCatalogBloc(documentRepository: sl()));
sl.registerFactory(() => ReviewWorkbenchBloc(reviewRepository: sl()));
```

---

## 4. Routing Architecture & Role Guards (`GoRouter`)

Navigation is declared using `go_router` with hierarchical nesting:
1. **Unauthenticated Stack:** `/login`, `/verify-email`, `/reset-password`, `/accept-invite`.
2. **Main Application Shell (StatefulShellRoute):** Persistent Bottom Navigation Bar managing 5 tabs:
   - Tab 0: `/dashboard` (`DashboardScreen`)
   - Tab 1: `/documents` (`DocumentCatalogScreen`)
   - Tab 2: `/review` (`ReviewQueueScreen`)
   - Tab 3: `/approvals` (`ApprovalsQueueScreen`)
   - Tab 4: `/profile` (`UserProfileScreen`)
3. **Modal & Push Stacks:**
   - Intake: `/intake` (Camera/Scanner Modal)
   - Detail: `/documents/:id` (`DocumentDetailScreen`)
   - Workbench: `/review/:id` (`ReviewWorkbenchScreen`)
   - Comparison: `/compare/:id` (`CompareDiffScreen`)
   - Q&A Chat: `/qa` (`QaChatScreen`)
   - Admin Views: `/admin/telemetry`, `/admin/users`, `/admin/retention`

### Role-Based Route Guard Logic
```dart
redirect: (BuildContext context, GoRouterState state) {
  final authState = context.read<AuthBloc>().state;
  final isLoggingIn = state.matchedLocation == '/login' || 
                      state.matchedLocation == '/verify-email';

  if (authState is Unauthenticated) {
    return isLoggingIn ? null : '/login';
  }

  if (authState is Authenticated) {
    if (isLoggingIn) return '/dashboard';
    
    // Enforce role boundaries on administrative routes
    if (state.matchedLocation.startsWith('/admin')) {
      final role = authState.user.role;
      if (role != 'org_admin' && role != 'platform_operator') {
        return '/access-denied';
      }
    }
  }
  return null;
}
```

---

## 5. Network Architecture & Token Lifecycle

### 5.1 Queued Token Refresh (`QueuedInterceptor`)
To eliminate session drops (`DEF-011` / `SEC-009`), `Dio` uses a synchronized queue:
1. Outbound requests receive `Authorization: Bearer <accessToken>`.
2. On `HTTP 401 Unauthorized`, the interceptor halts outbound traffic and locks the queue.
3. A single-flight `POST /api/v1/auth/refresh` request is dispatched with the `refreshToken`.
4. Upon HTTP 200: new tokens are persisted to `FlutterSecureStorage`, the queued requests update their auth headers and proceed.
5. Upon refresh rejection (HTTP 401/403): the queue is cleared, credentials purged, and `AuthBloc` transitions to `Unauthenticated`.

### 5.2 Distributed Tracing & Correlation
Every outgoing request automatically injects an `X-Correlation-Id` header (UUID v4). If a backend service returns an error, the correlation ID is captured and displayed in error dialogs to enable rapid cross-tier log inspection.

### 5.3 Mutation Idempotency
Non-idempotent operations (`POST /documents/upload`, `POST /approvals/:id/decision`, `PATCH /review/:id/fields/:key`) inject a client-generated `Idempotency-Key` header, allowing safe network retries without creating duplicate documents or double-approvals.

---

## 6. Document Review Coordinate Transformation (Fixing DEF-007)

On mobile viewports, review workbench coordinate scaling requires normalization to prevent bounding box misalignment (`DEF-007`):

1. **Normalized Geometry:** The backend stores coordinates as normalized ratios relative to page dimensions:
   $$x_{min}, y_{min}, x_{max}, y_{max} \in [0.0, 1.0]$$
2. **Dynamic Canvas Scaling:** The Flutter document viewer measures the rendered raster canvas via `LayoutBuilder`:
   $$\text{box.left} = x_{min} \times \text{canvasWidth}$$
   $$\text{box.top} = y_{min} \times \text{canvasHeight}$$
   $$\text{box.width} = (x_{max} - x_{min}) \times \text{canvasWidth}$$
   $$\text{box.height} = (y_{max} - y_{min}) \times \text{canvasHeight}$$
3. **Touch Targets:** A minimum touch target of $44 \times 44$ dp is enforced by expanding the interactive hit test area around small text bounding boxes.

---

## 7. Local Persistence & Data Isolation

1. **Sensitive Material:** Access tokens, refresh tokens, and user encryption keys are stored exclusively in hardware keystores via `FlutterSecureStorage` (`EncryptedSharedPreferences` on Android, `Keychain` on iOS).
2. **Metadata Cache:** Document metadata, catalog entries, and offline task drafts are stored in `drift` (SQLite). Every table includes a mandatory `tenant_id` column to prevent cross-tenant leakage.
3. **Document Binaries:** Original PDF/image binaries are cached temporarily in application cache directories (`path_provider`) and encrypted at rest using AES-GCM-256 keys derived from the user's secure token. Cached files are automatically purged on logout.
