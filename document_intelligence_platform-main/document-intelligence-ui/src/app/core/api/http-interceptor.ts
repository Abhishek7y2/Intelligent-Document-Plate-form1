import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError, BehaviorSubject, from, Observable, switchMap, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Injects distributed tracing correlation ID header on all outgoing HTTP requests.
 */
export const correlationHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('X-Correlation-ID')) {
    return next(req);
  }
  const correlationId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const cloned = req.clone({
    setHeaders: {
      'X-Correlation-ID': correlationId,
    },
  });
  return next(cloned);
};

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return from(authService.refreshAccessToken()).pipe(
      switchMap((newToken: string | null) => {
        isRefreshing = false;
        if (newToken) {
          refreshTokenSubject.next(newToken);
          const cloned = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`,
            },
          });
          return next(cloned);
        }
        authService.logout();
        return throwError(() => new Error('Session expired. Please log in again.'));
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token: string) => {
        const cloned = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next(cloned);
      })
    );
  }
}

/**
 * Injects JWT Bearer token and tenant scope, handling 401 with synchronized silent refresh.
 */
export const authHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // Skip refresh for auth endpoints to prevent recursion
  if (
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/verify-otp') ||
    req.url.includes('/auth/request-otp') ||
    req.url.includes('/auth/accept-invite')
  ) {
    return next(req);
  }

  const currentUser = authService.currentUser();
  const token =
    (isPlatformBrowser(platformId) ? localStorage.getItem('docintel-token') : null) ||
    currentUser?.token ||
    (currentUser ? `mock-jwt-token-${currentUser.id}` : null);

  let authReq = req;
  if (token) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (currentUser?.tenantId) {
      headers['X-Tenant-ID'] = currentUser.tenantId;
    }
    authReq = req.clone({
      setHeaders: headers,
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        const hasRefreshToken = isPlatformBrowser(platformId) && !!localStorage.getItem('docintel-refresh-token');
        if (hasRefreshToken) {
          return handle401Error(authReq, next, authService);
        }

        const currentToken = currentUser?.token;
        if (currentToken && !currentToken.startsWith('mock-')) {
          authService.logout();
        }
      }
      return throwError(() => error);
    })
  );
};
