# Native iOS Mobile Architecture Specification

## Architectural Pattern: MVVM + Combine
The DocuNexa iOS application is designed using native Swift, SwiftUI, and Combine, targeting iOS 17+.

```mermaid
graph TD
    View[SwiftUI View Layer] -->|User Actions| ViewModel[Observable ViewModel]
    ViewModel -->|State Updates / Published| View
    ViewModel -->|Repository Requests| Repository[Data Repository]
    Repository -->|Network Calls| ApiClient[URLSession REST Client]
    Repository -->|Local Storage| Keychain[Keychain / CoreData / SwiftData]
    ApiClient -->|Auth & Token Headers| Gateway[DocuNexa API Gateway]
```

---

## Core Mobile Modules
1. **VisionKit Document Scanner**: Uses Apple's native `VNDocumentCameraViewController` for automated edge detection, perspective skew correction, and multi-page batch scanning.
2. **Biometric Authentication (LocalAuthentication)**: FaceID / TouchID biometric unlocking backed by secure token storage in Apple Secure Enclave / Keychain.
3. **Mobile HITL & Approvals**: Optimized card-based swipe gestures for rapid document sign-offs and push notification reviews.
4. **Offline Sync & Storage**: Local encrypted caching using SwiftData with background URLSession sync when network connectivity is restored.
