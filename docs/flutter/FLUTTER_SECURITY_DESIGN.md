# FLUTTER MOBILE SECURITY DESIGN — DOCUNEXA PLATFORM

**Target Application:** DocuNexa Mobile Client  
**Security Baseline:** OWASP Mobile Application Security (MASVS Level 2)  
**Date:** 2026-10-16  

---

## 1. Threat Model & OWASP Mobile Mitigations

| OWASP Mobile Top 10 | Threat Vector | DocuNexa Mobile Countermeasure & Architectural Control |
| :--- | :--- | :--- |
| **M1: Improper Credential Usage** | Plaintext token storage, leaked API keys. | Tokens stored exclusively in hardware keystores (`flutter_secure_storage`). Zero hardcoded secrets. |
| **M2: Inadequate Supply Chain** | Compromised third-party packages. | Strict dependency lockfile (`pubspec.lock`), pinned package versions, minimal dependencies. |
| **M3: Insecure Authentication** | Client-side auth bypasses, hardcoded OTPs. | **Eliminated web flaws:** Omit demo role switcher (`DEF-010`) and local password bypass (`DEF-009`). Backend JWT mandatory. |
| **M4: Insufficient Input/Output** | Malicious file payloads, XSS/SQLi in cached views. | Strict file validation on client before upload; parameterized SQL in `drift`; HTML entity escaping. |
| **M5: Insecure Communication** | Man-in-the-Middle (MITM) on cellular/Wi-Fi. | Mandatory TLS 1.3; TLS Certificate Pinning on Staging/Prod; cleartext traffic disabled in Android manifest. |
| **M6: Inadequate Privacy Controls** | PII leakage via OS logs, keyboard cache, or previews. | Android `FLAG_SECURE` enabled on sensitive document viewer screens; OS clipboard auto-clear after 60s. |
| **M7: Insufficient Binary Protection**| Reverse engineering, dynamic hook injection (Frida). | R8 / ProGuard code obfuscation enabled; root/jailbreak detection warning banner. |
| **M8: Security Misconfiguration** | Debug flags left in release builds, permissive CORS. | Build flavors enforce `kReleaseMode`; debug logging stripped in production builds. |
| **M9: Insecure Data Storage** | Cached document PDFs accessible to other apps. | Application sandbox isolation; cached binaries encrypted using AES-GCM-256; purged on logout. |
| **M10: Insufficient Cryptography** | Weak hashing or legacy symmetric ciphers. | AES-256 for local database encryption; RS256 JWT tokens; HMAC-SHA256 for request signatures. |

---

## 2. Secure Credential Storage & Biometric Architecture

### 2.1 Hardware-Backed Key Storage
1. **Android:** Uses `EncryptedSharedPreferences` backed by the **Android Keystore System** (AES-256-GCM master key created inside the Trusted Execution Environment / Secure Element).
2. **iOS:** Uses the **iOS Keychain Services** with accessibility attribute `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

### 2.2 Biometric Authentication Workflow (`local_auth`)
- Biometric authentication (Fingerprint / FaceID) is an **access convenience mechanism**, **NEVER an identity provider**.
- Biometrics unlock the local encryption key required to read the stored `refreshToken` from the hardware keystore.
- If biometric authentication fails 3 times, the app falls back to requiring the user's primary account password.
- High-value transactions (e.g., approving an invoice > $50,000 or applying a Legal Hold) require an explicit biometric prompt before dispatching the HTTP request.

---

## 3. Elimination of Web-Tier Defect Bypasses

The DocuNexa Mobile client is explicitly designed to eliminate all vulnerabilities discovered in the web tier during Sprints 0B, 0C, and 0D:

1. **Elimination of Local Password Bypass (`DEF-009` / `SEC-007`):**
   - The Angular web client permitted any password of length $\ge 6$ to set local state.
   - The Flutter mobile client requires a valid, verified JWT signed by the backend before instantiating the user session.
2. **Elimination of Demo Role Switcher (`DEF-010` / `SEC-008`):**
   - The Angular web client exposed quick-login buttons (`loginByRole`) that bypassed authentication.
   - The Flutter mobile client completely omits these buttons in all build flavors.
3. **Elimination of Master OTP Backdoors (`DEF-012` / `SEC-001`):**
   - Static bypass codes `742918` and `123456` were removed from backend code in Sprint 0D. The mobile app interfaces strictly with genuine email/SMS OTP verification.
4. **Elimination of Dynamic Admin Escalation (`DEF-014` / `SEC-003`):**
   - The mobile client relies strictly on verified JWT claims (`user.role`) issued by the server.

---

## 4. Local Data & Cache Protection

1. **Tenant Boundary Isolation:**
   - Every cached entity in the local `drift` database is keyed by `tenant_id`.
   - Queries always include `WHERE tenant_id = :currentTenantId` to prevent multi-tenant data leakage if multiple accounts use the device.
2. **Document Binary Cache Purge:**
   - Document page images and PDFs rendered in the review workbench are written to the application's temporary cache directory (`path_provider`).
   - On user logout or session expiration, `SecureStorageService` executes a zero-trace cache purge deleting all temporary files.
3. **Screen Privacy Protection (`FLAG_SECURE`):**
   - To prevent sensitive financial documents from being captured in OS app-switcher screenshots or screen recorders, the mobile app sets `FLAG_SECURE` on Android and applies a blur overlay on iOS when entering background state.
