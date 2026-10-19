# Stage 1: Build Angular Production Distribution
FROM node:22.12.0-alpine3.21 AS builder

WORKDIR /app

COPY package*.json angular.json tsconfig*.json ./
RUN npm ci

COPY public ./public
COPY src ./src
RUN npm run build -- --configuration production

# Stage 2: Hardened Nginx Production Container (Part A.3)
FROM nginx:1.27.3-alpine-slim

# Remove default nginx static html
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled Angular distribution
COPY --from=builder /app/dist/document-intelligence-ui/browser /usr/share/nginx/html

# Copy production nginx configuration with security headers & SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Grant ownership to non-root nginx user
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
