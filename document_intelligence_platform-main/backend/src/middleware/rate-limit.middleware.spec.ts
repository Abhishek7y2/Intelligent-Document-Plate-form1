import { Request, Response } from 'express';
import { createRateLimiter, RateLimiterStore, PostgresRateLimiterStore, IRateLimiterStore, RateLimitRecord } from './rate-limit.middleware.js';

describe('Sprint 2 Closure: Authentication Rate Limiter Middleware', () => {
  let customStore: RateLimiterStore;

  beforeEach(() => {
    customStore = new RateLimiterStore();
  });

  it('should allow requests within the configured max limit and set RateLimit headers', async () => {
    const rateLimiter = createRateLimiter(
      { windowMs: 60000, max: 3 },
      customStore
    );

    const headersSent: Record<string, any> = {};
    const mockRes = {
      setHeader: (name: string, value: any) => {
        headersSent[name] = value;
      },
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const mockReq = {
      ip: '192.168.1.100',
      headers: {},
      originalUrl: '/api/v1/auth/login',
    } as unknown as Request;

    const mockNext = jest.fn();

    // First request
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(headersSent['RateLimit-Limit']).toBe(3);
    expect(headersSent['RateLimit-Remaining']).toBe(2);

    // Second request
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2);
    expect(headersSent['RateLimit-Remaining']).toBe(1);

    // Third request (exactly at limit)
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(3);
    expect(headersSent['RateLimit-Remaining']).toBe(0);
  });

  it('should reject requests exceeding max limit with HTTP 429 and RFC-7807 error format', async () => {
    const rateLimiter = createRateLimiter(
      { windowMs: 60000, max: 2, message: 'Too many login attempts.' },
      customStore
    );

    const headersSent: Record<string, any> = {};
    let responseStatus = 0;
    let responseBody: any = null;

    const mockRes = {
      setHeader: (name: string, value: any) => {
        headersSent[name] = value;
      },
      status: (status: number) => {
        responseStatus = status;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as unknown as Response;

    const mockReq = {
      ip: '10.0.0.50',
      headers: { 'x-correlation-id': 'REQ-RATE-TEST-99' },
      originalUrl: '/api/v1/auth/login',
    } as unknown as Request;

    const mockNext = jest.fn();

    // Hit 1 & 2 (allowed)
    await rateLimiter(mockReq, mockRes, mockNext);
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2);

    // Hit 3 (exceeded)
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2); // Next was not called for 3rd
    expect(responseStatus).toBe(429);
    expect(responseBody.type).toContain('RATE_LIMIT_EXCEEDED');
    expect(responseBody.title).toBe('Too many login attempts.');
    expect(responseBody.correlationId).toBe('REQ-RATE-TEST-99');
    expect(headersSent['Retry-After']).toBeDefined();
    expect(headersSent['RateLimit-Remaining']).toBe(0);
  });

  it('should reset limits when store is cleared', async () => {
    const rateLimiter = createRateLimiter(
      { windowMs: 60000, max: 1 },
      customStore
    );

    const mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const mockReq = {
      ip: '172.16.0.1',
      headers: {},
      originalUrl: '/api/v1/auth/login',
    } as unknown as Request;

    const mockNext = jest.fn();

    // First request
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // Clear store
    customStore.clear();

    // After reset, request should succeed again
    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('should support asynchronous distributed store implementations (e.g. Redis)', async () => {
    const mockDistributedStore: IRateLimiterStore = {
      get: jest.fn().mockImplementation(async (key: string, windowMs: number): Promise<RateLimitRecord> => {
        return { count: 1, resetTime: Date.now() + windowMs };
      }),
    };

    const rateLimiter = createRateLimiter({ windowMs: 30000, max: 5 }, mockDistributedStore);
    const mockNext = jest.fn();
    const mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const mockReq = {
      ip: '192.168.1.200',
      headers: {},
      originalUrl: '/api/v1/auth/login',
    } as unknown as Request;

    await rateLimiter(mockReq, mockRes, mockNext);
    expect(mockDistributedStore.get).toHaveBeenCalledWith('192.168.1.200', 30000);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should never expose sensitive body credentials in rate limit operations', async () => {
    const rateLimiter = createRateLimiter({ windowMs: 60000, max: 1 }, customStore);
    const mockNext = jest.fn();
    const mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const sensitiveBodyReq = {
      ip: '10.20.30.40',
      headers: {},
      body: { email: 'admin@docunexa.io', password: 'SuperSecretPassword!' },
      originalUrl: '/api/v1/auth/login',
    } as unknown as Request;

    // Trigger hit 1 (ok) and hit 2 (exceeded)
    await rateLimiter(sensitiveBodyReq, mockRes, mockNext);
    await rateLimiter(sensitiveBodyReq, mockRes, mockNext);

    // Verify rate limit keying is strictly decoupled from request body secrets
    expect(customStore.has('10.20.30.40')).toBe(true);
    expect(customStore.has('admin@docunexa.io')).toBe(false);
    expect(customStore.has('SuperSecretPassword!')).toBe(false);
  });

  describe('PostgresRateLimiterStore (Distributed Multi-Instance Store)', () => {
    it('should atomically update count and reset_time via PostgreSQL upsert query', async () => {
      const mockRows = [{ count: 1, reset_time: Date.now() + 60000 }];
      const mockPool = {
        query: jest.fn().mockResolvedValue({ rows: mockRows }),
      };

      const pgStore = new PostgresRateLimiterStore(mockPool);
      const res = await pgStore.get('192.168.1.55', 60000);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('INSERT INTO rate_limit_entries');
      expect(mockPool.query.mock.calls[0][0]).toContain('ON CONFLICT (key) DO UPDATE');
      expect(res.count).toBe(1);
    });

    it('should allow two application instances to share the same rate limit state', async () => {
      let sharedCount = 0;
      const sharedResetTime = Date.now() + 60000;
      const mockPool = {
        query: jest.fn().mockImplementation(async () => {
          sharedCount++;
          return { rows: [{ count: sharedCount, reset_time: sharedResetTime }] };
        }),
      };

      // Instance A and Instance B share the same database pool
      const instanceAStore = new PostgresRateLimiterStore(mockPool);
      const instanceBStore = new PostgresRateLimiterStore(mockPool);

      const hit1 = await instanceAStore.get('10.0.0.99', 60000);
      const hit2 = await instanceBStore.get('10.0.0.99', 60000);

      expect(hit1.count).toBe(1);
      expect(hit2.count).toBe(2);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should fail-open / fall back to memory store when PostgreSQL query fails', async () => {
      const failingPool = {
        query: jest.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
      };

      const pgStore = new PostgresRateLimiterStore(failingPool);
      const result = await pgStore.get('10.0.0.101', 60000);

      expect(result).toBeDefined();
      expect(result.count).toBe(1);
    });
  });
});
