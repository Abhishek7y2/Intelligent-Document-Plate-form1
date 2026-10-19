# DocuNexa Enterprise Deployment Runbook

**Environment:** Production / Staging  
**Stack:** Angular 19 UI | Node.js v22 LTS API | PostgreSQL 16 (`pgvector`)  

---

## 1. 🚀 Local Development Environment Setup

### 1. Prerequisites
- Node.js `v20.x` or `v22.x` LTS
- npm `v10.x`
- PostgreSQL `v16.x` with `pgvector` extension installed

### 2. Angular Web Application Launch
```bash
# 1. Navigate to Angular workspace
cd "document_intelligence_platform-main/document-intelligence-ui"

# 2. Install dependencies
npm install

# 3. Start local development server
npm start
```
- App will serve on `http://localhost:4200` with live reload.

---

## 2. 🐳 Production Container Deployment

### Docker Multi-Stage Build (`Dockerfile`)
```dockerfile
# 1. Build Stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# 2. Production Nginx Stage
FROM nginx:1.25-alpine
COPY --from=build /app/dist/document-intelligence-ui/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
