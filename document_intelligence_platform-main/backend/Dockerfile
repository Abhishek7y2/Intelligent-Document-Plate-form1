# Multi-stage Dockerfile for DocuNexa Enterprise Backend (Node.js 22 LTS)
# Base images are pinned to specific immutable digests/tags (Part A.3)

# --- Stage 1: Build & Prune ---
FROM node:22.12.0-alpine3.21 AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy application source & OpenAPI spec
COPY src/ ./src/
COPY openapi.yaml ./openapi.yaml

# Compile TypeScript
RUN npm run build

# Prune devDependencies for clean production footprint
RUN npm prune --omit=dev

# --- Stage 2: Production Minimal Runtime ---
FROM node:22.12.0-alpine3.21 AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install runtime utilities for OCR & PDF processing (Tesseract OCR & Poppler)
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    poppler-utils \
    curl \
    wget

# Copy production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/openapi.yaml ./openapi.yaml

# Set ownership to unprivileged non-root node user (UID 1000)
RUN chown -R node:node /app

USER node

EXPOSE 8080

# Production Healthcheck (NFR-01)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health/live || exit 1

# Default command starts API server. Worker container overrides CMD: ["node", "dist/worker.js"]
CMD ["node", "dist/server.js"]
