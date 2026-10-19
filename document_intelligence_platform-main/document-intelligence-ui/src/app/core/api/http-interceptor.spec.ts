import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, PLATFORM_ID } from '@angular/core';
import { HttpRequest, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authHttpInterceptor, correlationHttpInterceptor } from './http-interceptor';
import { AuthService } from '../services/auth.service';

describe('HTTP Interceptors Spec (DEF-011)', () => {
  describe('correlationHttpInterceptor', () => {
    it('attaches an X-Correlation-ID header if not present', () => {
      const req = new HttpRequest('GET', '/api/v1/documents');
      let interceptedReq: any;
      const next: any = (r: any) => {
        interceptedReq = r;
        return of(new HttpResponse({ status: 200 }));
      };

      correlationHttpInterceptor(req, next).subscribe();

      expect(interceptedReq).toBeDefined();
      expect(interceptedReq.headers.has('X-Correlation-ID')).toBe(true);
      expect(interceptedReq.headers.get('X-Correlation-ID')).toMatch(/^REQ-\d+-\d+$/);
    });

    it('preserves existing X-Correlation-ID header', () => {
      const req = new HttpRequest('GET', '/api/v1/documents', {
        headers: new HttpRequest('GET', '/api/v1/documents').headers.set('X-Correlation-ID', 'EXISTING-ID'),
      });
      let interceptedReq: any;
      const next: any = (r: any) => {
        interceptedReq = r;
        return of(new HttpResponse({ status: 200 }));
      };

      correlationHttpInterceptor(req, next).subscribe();
      expect(interceptedReq.headers.get('X-Correlation-ID')).toBe('EXISTING-ID');
    });
  });

  describe('authHttpInterceptor', () => {
    let mockAuthService: any;
    let mockRouter: any;
    let injector: Injector;

    beforeEach(() => {
      mockAuthService = {
        currentUser: vi.fn().mockReturnValue({
          id: 'USR-ADMIN',
          tenantId: 'TNT-CORP-01',
          token: 'active-jwt-token-abc',
        }),
        logout: vi.fn(),
        refreshAccessToken: vi.fn(),
      };

      mockRouter = {
        navigate: vi.fn(),
      };

      injector = Injector.create({
        providers: [
          { provide: AuthService, useValue: mockAuthService },
          { provide: Router, useValue: mockRouter },
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });

      localStorage.clear();
    });

    it('attaches Bearer token and X-Tenant-ID headers for authenticated requests', () => {
      const req = new HttpRequest('GET', '/api/v1/documents');
      let passedReq: any;
      const next: any = (r: any) => {
        passedReq = r;
        return of(new HttpResponse({ status: 200 }));
      };

      runInInjectionContext(injector, () => {
        authHttpInterceptor(req, next).subscribe();
      });

      expect(passedReq.headers.get('Authorization')).toBe('Bearer active-jwt-token-abc');
      expect(passedReq.headers.get('X-Tenant-ID')).toBe('TNT-CORP-01');
    });

    it('triggers silent token refresh and retries request on HTTP 401 when refresh token is available', async () => {
      localStorage.setItem('docintel-refresh-token', 'valid-refresh-token-xyz');
      mockAuthService.refreshAccessToken.mockResolvedValue('new-refreshed-jwt-token');

      const req = new HttpRequest('GET', '/api/v1/documents');
      let callCount = 0;
      let lastReq: any;

      const next: any = (r: any) => {
        callCount++;
        lastReq = r;
        if (callCount === 1) {
          // First attempt fails with 401 Unauthorized
          return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
        }
        // Second attempt with refreshed token succeeds
        return of(new HttpResponse({ status: 200, body: { data: [] } }));
      };

      await new Promise<void>((resolve, reject) => {
        runInInjectionContext(injector, () => {
          authHttpInterceptor(req, next).subscribe({
            next: (res: any) => {
              try {
                expect(res.status).toBe(200);
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            error: reject,
          });
        });
      });

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalled();
      expect(callCount).toBe(2);
      expect(lastReq.headers.get('Authorization')).toBe('Bearer new-refreshed-jwt-token');
    });

    it('logs out and clears session if refresh token call fails on HTTP 401', async () => {
      localStorage.setItem('docintel-refresh-token', 'expired-refresh-token');
      mockAuthService.refreshAccessToken.mockResolvedValue(null);

      const req = new HttpRequest('GET', '/api/v1/documents');
      const next: any = () => throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));

      await new Promise<void>((resolve) => {
        runInInjectionContext(injector, () => {
          authHttpInterceptor(req, next).subscribe({
            error: () => {
              expect(mockAuthService.logout).toHaveBeenCalled();
              resolve();
            },
          });
        });
      });
    });
  });
});
