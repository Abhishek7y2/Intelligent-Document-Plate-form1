# 🐳 DocuNexa DevOps, Docker & Kubernetes Deployment Specification

**Overview:** Complete orchestration and containerization plan for DocuNexa Enterprise Platform.

---

## 1. 📦 Local Orchestration (`docker-compose.yml`)

Save this file as `docker-compose.yml` in the project root to spin up the entire infrastructure locally in 1 command: `docker-compose up -d`.

```yaml
version: '3.8'

services:
  # 1. Angular 19 Frontend Web UI
  docunexa-ui:
    build:
      context: ./document-intelligence-ui
      dockerfile: Dockerfile
    ports:
      - "4200:80"
    depends_on:
      - api-gateway
    environment:
      - NODE_ENV=production

  # 2. Go API Gateway
  api-gateway:
    build:
      context: ./docunexa-backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - POSTGRES_URI=postgres://docunexa_user:Secret123@postgres:5432/docunexa_db?sslmode=disable
      - MONGO_URI=mongodb://docunexa_admin:Secret123@mongodb:27017/docunexa_nosql?authSource=admin
      - REDIS_URI=redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - mongodb
      - redis

  # 3. PostgreSQL 16 (Relational Outbox & RBAC)
  postgres:
    image: postgres:16-alpine
    container_name: docunexa-postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=docunexa_user
      - POSTGRES_PASSWORD=Secret123
      - POSTGRES_DB=docunexa_db
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docs/DATABASE_SCHEMA_POSTGRES.sql:/docker-entrypoint-initdb.d/init.sql

  # 4. MongoDB 7.0 (OCR Page Layouts & Vectors)
  mongodb:
    image: mongo:7.0
    container_name: docunexa-mongodb
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=docunexa_admin
      - MONGO_INITDB_ROOT_PASSWORD=Secret123
    volumes:
      - mongodata:/data/db

  # 5. Redis Cache & Event Pub/Sub
  redis:
    image: redis:7.2-alpine
    container_name: docunexa-redis
    ports:
      - "6379:6379"

volumes:
  pgdata:
  mongodata:
```

---

## 2. ⚡ Angular Multi-Stage Dockerfile (`document-intelligence-ui/Dockerfile`)

```dockerfile
# Stage 1: Build Angular App
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve with Nginx Light
FROM nginx:1.25-alpine
COPY --from=build /app/dist/document-intelligence-ui/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 3. 🔐 Environment Configuration (`.env.example`)

```env
# Application Settings
APP_ENV=production
PORT=8080

# Relational Database (PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=docunexa_user
POSTGRES_PASSWORD=replace_with_strong_postgres_password
POSTGRES_DB=docunexa_db

# Document Storage (MongoDB)
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=docunexa_nosql

# Security & JWT
JWT_SECRET=replace_with_random_signing_secret
JWT_EXPIRATION_HOURS=8

# Telemetry & Audit
AUDIT_HMAC_SECRET=replace_with_random_audit_hmac_secret
```
