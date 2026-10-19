# DocuNexa Backend Development Setup Guide

**Runtime:** Node.js 22 LTS  
**TypeScript Version:** v5.5  
**Directory:** `document_intelligence_platform-main/backend/`  

---

## 1. Quick Start

```bash
# 1. Navigate to backend directory
cd document_intelligence_platform-main/backend

# 2. Install dependencies
npm install

# 3. Compile TypeScript code
npm run build

# 4. Run automated unit tests
npm test

# 5. Start development server with live reload
npm run dev
```

---

## 2. Environment Variables (`.env`)

Copy `.env.example` to `.env` in the backend root directory:

```env
NODE_ENV=development
PORT=8080
API_PREFIX=/api/v1
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=docunexa_user
POSTGRES_PASSWORD=replace_with_strong_postgres_password
POSTGRES_DB=docunexa_db
JWT_SECRET=replace_with_random_signing_secret
```
