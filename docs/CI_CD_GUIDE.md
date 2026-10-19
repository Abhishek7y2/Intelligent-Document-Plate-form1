# DocuNexa CI/CD & GitHub Actions Guide

**CI Engine:** GitHub Actions  
**Workflow File:** `.github/workflows/ci.yml`  

---

## 1. Automated Pipeline Jobs

1. **`backend-ci`**:
   - Runs on `ubuntu-latest` with Node.js 22 LTS.
   - Installs dependencies via `npm ci`.
   - Executes TypeScript typechecking and production build (`npm run build`).

2. **`frontend-ci`**:
   - Runs on `ubuntu-latest` with Node.js 20.
   - Builds Angular 19 Standalone application in production configuration.
