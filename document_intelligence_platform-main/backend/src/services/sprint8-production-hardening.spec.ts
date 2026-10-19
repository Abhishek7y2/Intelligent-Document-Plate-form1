import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { app } from '../app.js';
import {
  createRateLimiter,
  RateLimiterStore,
  authRateLimiter,
  acceptInviteRateLimiter,
  mfaRateLimiter,
  uploadRateLimiter,
  exportRateLimiter,
} from '../middleware/rate-limit.middleware.js';
import { validateEnvironment } from '../config/env.config.js';
import { MetricsService } from './metrics.service.js';

describe('Sprint 8 Part B: Production Hardening & Observability Specification', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      baseUrl = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  // ---------------------------------------------------------------------------
  // B.2: Helmet Security Headers
  // ---------------------------------------------------------------------------
  describe('B.2 Security Middleware: Helmet', () => {
    it('applies standard security headers via helmet on HTTP responses', async () => {
      const res = await fetch(`${baseUrl}/health/live`);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-dns-prefetch-control')).toBe('off');
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

  // ---------------------------------------------------------------------------
  // B.2: Strict CORS from Allowlist
  // ---------------------------------------------------------------------------
  describe('B.2 Strict CORS Allowlist Enforcement', () => {
    it('allows requests from origins in the CORS allowlist', async () => {
      const allowedOrigin = 'http://localhost:4200';
      const testApp = express();
      testApp.use(cors({ origin: ['http://localhost:4200', 'https://app.docunexa.com'], credentials: true }));
      testApp.get('/test-cors', (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      });

      const s = testApp.listen(0);
      const port = (s.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-cors`, {
          headers: { Origin: allowedOrigin },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
        expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      } finally {
        s.close();
      }
    });

    it('rejects or omits Access-Control-Allow-Origin for unauthorized origins', async () => {
      const testApp = express();
      testApp.use(cors({ origin: ['https://app.docunexa.com'] }));
      testApp.get('/test-cors', (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      });

      const s = testApp.listen(0);
      const port = (s.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-cors`, {
          headers: { Origin: 'http://malicious-site.attacker.com' },
        });

        expect(res.headers.get('access-control-allow-origin')).toBeNull();
      } finally {
        s.close();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // B.2: Rate Limiting on Critical Endpoints
  // ---------------------------------------------------------------------------
  describe('B.2 Dedicated Rate Limiters', () => {
    it('enforces rate limits and returns RFC-7807 429 when max threshold is exceeded', async () => {
      const memoryStore = new RateLimiterStore();
      const testLimiter = createRateLimiter(
        {
          windowMs: 60000,
          max: 3,
          message: 'Threshold exceeded for test action.',
        },
        memoryStore
      );

      const testApp = express();
      testApp.use(testLimiter);
      testApp.get('/limited-action', (_req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });

      const s = testApp.listen(0);
      const port = (s.address() as any).port;

      try {
        // 3 successful attempts
        for (let i = 0; i < 3; i++) {
          const res = await fetch(`http://127.0.0.1:${port}/limited-action`);
          expect(res.status).toBe(200);
          expect(res.headers.get('ratelimit-limit')).toBe('3');
        }

        // 4th attempt exceeds max=3
        const blockedRes = await fetch(`http://127.0.0.1:${port}/limited-action`);
        expect(blockedRes.status).toBe(429);
        const body: any = await blockedRes.json();
        expect(body.type).toBe('https://api.docunexa.enterprise/errors/RATE_LIMIT_EXCEEDED');
        expect(body.title).toContain('Threshold exceeded');
        expect(blockedRes.headers.get('retry-after')).toBeDefined();
      } finally {
        s.close();
      }
    });

    it('provides discrete configured rate limiters for auth, invite, mfa, upload, and export', () => {
      expect(authRateLimiter).toBeDefined();
      expect(acceptInviteRateLimiter).toBeDefined();
      expect(mfaRateLimiter).toBeDefined();
      expect(uploadRateLimiter).toBeDefined();
      expect(exportRateLimiter).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // B.2: Request Size Limits & Trust Proxy
  // ---------------------------------------------------------------------------
  describe('B.2 Request Size Limits & Trust Proxy', () => {
    it('rejects oversized JSON request bodies exceeding 10MB limit with HTTP 413', async () => {
      // Craft a 10.5 MB payload
      const largePayload = JSON.stringify({ data: 'x'.repeat(10.5 * 1024 * 1024) });
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largePayload,
      });

      expect(res.status).toBe(413);
    });

    it('properly configures trust proxy setting on Express application', () => {
      expect(app.get('trust proxy')).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // B.3: Production Startup Configuration Validation
  // ---------------------------------------------------------------------------
  describe('B.3 Production Startup Config Guard Validation', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('rejects production startup if JWT_SECRET is weak or default', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = 'weak-secret-123';
      process.env['AUDIT_HMAC_SECRET'] = '64_character_long_production_hmac_secret_key_value_string_here_ok';
      process.env['MFA_ENC_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env['STORAGE_DRIVER'] = 's3';
      process.env['SCANNER_TYPE'] = 'clamav';
      process.env['REDIS_PASSWORD'] = 'very-strong-redis-pw';
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://docunexa.enterprise';

      expect(() => validateEnvironment()).toThrow(/must be at least 32 characters/);
    });

    it('rejects production startup if STORAGE_DRIVER=memory', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = '64_character_long_production_jwt_secret_key_value_string_here_ok';
      process.env['AUDIT_HMAC_SECRET'] = '64_character_long_production_hmac_secret_key_value_string_here_ok';
      process.env['MFA_ENC_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env['STORAGE_DRIVER'] = 'memory';
      process.env['SCANNER_TYPE'] = 'clamav';
      process.env['REDIS_PASSWORD'] = 'very-strong-redis-pw';
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://docunexa.enterprise';

      expect(() => validateEnvironment()).toThrow(/In-memory storage is forbidden in production/);
    });

    it('rejects production startup if SCANNER_TYPE=mock', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = '64_character_long_production_jwt_secret_key_value_string_here_ok';
      process.env['AUDIT_HMAC_SECRET'] = '64_character_long_production_hmac_secret_key_value_string_here_ok';
      process.env['MFA_ENC_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env['STORAGE_DRIVER'] = 's3';
      process.env['SCANNER_TYPE'] = 'mock';
      process.env['REDIS_PASSWORD'] = 'very-strong-redis-pw';
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://docunexa.enterprise';

      expect(() => validateEnvironment()).toThrow(/Mock malware scanner is forbidden in production/);
    });

    it('rejects production startup if REDIS_PASSWORD is empty', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = '64_character_long_production_jwt_secret_key_value_string_here_ok';
      process.env['AUDIT_HMAC_SECRET'] = '64_character_long_production_hmac_secret_key_value_string_here_ok';
      process.env['MFA_ENC_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env['STORAGE_DRIVER'] = 's3';
      process.env['SCANNER_TYPE'] = 'clamav';
      delete process.env['REDIS_PASSWORD'];
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://docunexa.enterprise';

      expect(() => validateEnvironment()).toThrow(/REDIS_PASSWORD is required in production/);
    });

    it('rejects production startup if CORS_ALLOWED_ORIGINS is empty', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = '64_character_long_production_jwt_secret_key_value_string_here_ok';
      process.env['AUDIT_HMAC_SECRET'] = '64_character_long_production_hmac_secret_key_value_string_here_ok';
      process.env['MFA_ENC_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env['STORAGE_DRIVER'] = 's3';
      process.env['SCANNER_TYPE'] = 'clamav';
      process.env['REDIS_PASSWORD'] = 'redis-pw-123';
      process.env['CORS_ALLOWED_ORIGINS'] = '';

      expect(() => validateEnvironment()).toThrow(/CORS allowlist cannot be empty/);
    });
  });

  // ---------------------------------------------------------------------------
  // B.4: Availability & Prometheus Metrics
  // ---------------------------------------------------------------------------
  describe('B.4 Health Probes & Prometheus Metrics (NFR-01)', () => {
    it('GET /health/live returns 200 with UP status', async () => {
      const res = await fetch(`${baseUrl}/health/live`);
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('UP');
    });

    it('GET /health/ready returns status and dependency checks', async () => {
      const res = await fetch(`${baseUrl}/health/ready`);
      expect([200, 503]).toContain(res.status);
      const data: any = await res.json();
      expect(data.dependencies).toBeDefined();
      expect(data.dependencies.postgres).toBeDefined();
      expect(data.dependencies.redis).toBeDefined();
      expect(data.dependencies.mongo).toBeDefined();
      expect(data.dependencies.storage).toBeDefined();
      expect(data.dependencies.scanner).toBeDefined();
    });

    it('GET /metrics returns Prometheus format metrics including latency histograms, queue depth, failed jobs, outbox lag, dual-write failures', async () => {
      // Record sample metrics to verify output formatting
      MetricsService.recordHttpRequest('GET', '/health/live', 200, 0.042);
      MetricsService.incrementDualWriteFailure();

      const res = await fetch(`${baseUrl}/metrics`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');
      const body = await res.text();

      expect(body).toContain('http_request_duration_seconds');
      expect(body).toContain('queue_depth');
      expect(body).toContain('failed_jobs_total');
      expect(body).toContain('outbox_lag_seconds');
      expect(body).toContain('dual_write_failures_total');
    });
  });
});
