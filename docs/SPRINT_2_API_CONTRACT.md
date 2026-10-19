# DocuNexa Sprint 2: Identity & Session API Contract

**Base URL:** `http://localhost:8080/api/v1`  
**Protocol:** REST over HTTPS  

---

## 1. Endpoints

### `POST /auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "analyst@docunexa.io",
    "password": "<your-test-password>",
    "tenantId": "TNT-CORP-01" // Optional
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "4a98f12c...",
    "expiresIn": 28800,
    "user": {
      "userId": "USR-88210",
      "email": "analyst@docunexa.io",
      "fullName": "Jane Doe",
      "role": "Reviewer",
      "tenantId": "TNT-CORP-01",
      "permissions": ["DOC_VIEW", "DOC_EDIT", "DOC_VERIFY", "REPORT_GENERATE"]
    }
  }
  ```

---

### `POST /auth/refresh`
- **Access:** Public (Requires valid Refresh Token)
- **Request Body:**
  ```json
  {
    "refreshToken": "4a98f12c..."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "8b12e34d...",
    "expiresIn": 28800
  }
  ```

---

### `POST /auth/logout`
- **Access:** Public / Authenticated
- **Request Body:**
  ```json
  {
    "refreshToken": "8b12e34d..."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "message": "Successfully logged out and session revoked."
  }
  ```

---

### `GET /auth/me`
- **Access:** Protected (`Authorization: Bearer <token>`)
- **Response `200 OK`:**
  ```json
  {
    "user": {
      "userId": "USR-88210",
      "email": "analyst@docunexa.io",
      "role": "Reviewer",
      "tenantId": "TNT-CORP-01",
      "permissions": ["DOC_VIEW", "DOC_EDIT", "DOC_VERIFY", "REPORT_GENERATE"]
    }
  }
  ```
