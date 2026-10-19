# DocuNexa Sprint 2: Authentication & Session Architecture Design

**Focus:** Password Security, JWT Lifecycle, and Refresh Token Family Rotation  

---

## 1. Authentication Lifecycle

```
[ Client ]                   [ Express API ]                    [ PostgreSQL ]
    │                              │                                  │
    ├── 1. POST /auth/login ───────►                                  │
    │   { email, password }        ├── 2. Query user & hash ──────────►
    │                              │◄── 3. Return user record ─────────┤
    │                              ├── 4. Verify password (bcrypt)    │
    │                              ├── 5. Generate Access & Refresh   │
    │                              ├── 6. Store hashed refresh token ─►
    │   ◄── 7. Return 200 OK ──────┤                                  │
    │       { token, refreshToken }│                                  │
    │                              │                                  │
    ├── 8. POST /auth/refresh ─────►                                  │
    │   { refreshToken }           ├── 9. Check session & family ─────►
    │                              │   (Reuse Detection Logic)        │
    │                              ├── 10. Invalidate old token       │
    │                              ├── 11. Issue & store new token ───►
    │   ◄── 12. Return 200 OK ─────┤                                  │
```

---

## 2. Token Specifications

| Token Type | Lifespan | Signing / Hash Strategy | Stored In Database? | Transport |
| :--- | :--- | :--- | :--- | :--- |
| **Access Token** | 8 Hours | HMAC SHA-256 (`HS256`) | No (Stateless JWT) | `Authorization: Bearer <token>` |
| **Refresh Token** | 7 Days | Cryptographic Entropy (32 bytes) | Yes (SHA-256 Hash Only) | Response JSON Payload |

---

## 3. Token Family Reuse Detection & Attack Defense

When an attacker attempts to replay an old refresh token that has already been rotated:
1. `AuthService.refresh()` detects `session.is_revoked === true`.
2. The entire token family (`family_id`) is flagged revoked immediately across PostgreSQL.
3. The server emits an `ERROR` log and returns HTTP 401 `REFRESH_TOKEN_REUSE`.
4. Both the attacker and legitimate user are forced to re-authenticate, safeguarding the account.
