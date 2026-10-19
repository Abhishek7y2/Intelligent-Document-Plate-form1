import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Role, DEMO_ROLES } from '../models/roles';
import { AuthUser, UserProfileDto, UpdateProfileDto, SessionItemDto } from '../models/auth.model';
import { NotificationService } from './notification.service';

export type { AuthUser, UserProfileDto, UpdateProfileDto, SessionItemDto } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly storageKey = 'docintel-auth';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService, { optional: true });

  readonly currentUser = signal<AuthUser | null>(this.getStoredUser());

  private readonly usersList: AuthUser[] = DEMO_ROLES.map((role) => ({
    id: `USR-${role.id.toUpperCase()}`,
    name: `${role.name} User`,
    email: role.demoEmail,
    role: role.id,
    organization: role.organization,
    avatarInitials: role.avatarInitials,
    status: 'active',
    tenantId: 'TNT-CORP-01',
  }));

  async getSmtpStatus(): Promise<{ configured: boolean; host: string; port: number; secure: boolean; from: string } | null> {
    try {
      const res = await fetch('/api/v1/auth/smtp-status');
      if (res.ok) {
        const data = await res.json();
        return data.smtp;
      }
    } catch {
      // Offline or network error
    }
    return null;
  }

  async requestOtp(email: string): Promise<{ success: boolean; message: string; testOtp?: string; smtp?: any }> {
    try {
      const res = await fetch('/api/v1/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to dispatch verification email.' };
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error communicating with mail server.' };
    }
  }

  async verifyOtpAndLogin(email: string, code: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Invalid or expired verification code.' };
      }

      const roleStr = data.user?.role?.toLowerCase() || 'admin';
      const authUser: AuthUser = {
        id: data.user?.userId || `USR-${email.split('@')[0].toUpperCase()}`,
        name: data.user?.fullName || email.split('@')[0],
        email: data.user?.email || email,
        role: (roleStr === 'admin' ? 'org_admin' : 'reviewer') as Role,
        organization: 'Acme Enterprise',
        avatarInitials: (data.user?.fullName || email).substring(0, 2).toUpperCase(),
        status: 'active',
        tenantId: data.user?.tenantId || 'TNT-CORP-01',
      };

      if (isPlatformBrowser(this.platformId) && data.token) {
        localStorage.setItem('docintel-token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('docintel-refresh-token', data.refreshToken);
        }
      }

      this.setCurrentUser(authUser, true);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error verifying passcode.' };
    }
  }

  loginByEmail(email: string): boolean {
    const trimmedEmail = email.trim().toLowerCase();
    const matchedUser = this.usersList.find(
      (u) => u.email.toLowerCase() === trimmedEmail
    ) || {
      id: 'USR-ADMIN',
      name: email.split('@')[0],
      email: trimmedEmail,
      role: 'org_admin' as Role,
      organization: 'Acme Enterprise',
      avatarInitials: 'AE',
      status: 'active' as const,
      tenantId: 'TNT-CORP-01',
    };

    this.setCurrentUser(matchedUser, true);
    return true;
  }

  loginByRole(role: Role): boolean {
    const matchedUser = this.usersList.find((u) => u.role === role);
    if (!matchedUser) return false;

    if (!matchedUser.tenantId) {
      matchedUser.tenantId = 'TNT-CORP-01';
    }

    this.setCurrentUser(matchedUser, true);
    return true;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.storageKey);
      sessionStorage.removeItem(this.storageKey);
    }
    this.notificationService?.closeRealtimeStream();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  getUser(): AuthUser | null {
    return this.currentUser();
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser();
  }

  async loginApi(
    email: string,
    password: string,
    mfaCode?: string,
    rememberMe = true
  ): Promise<{ success: boolean; mfaRequired?: boolean; message?: string }> {
    const trimmedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password, mfaCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        return { success: false, message: 'Too many login attempts. Account temporarily throttled. Please try again later.' };
      }

      if (data?.mfaRequired || data?.error?.code === 'MFA_REQUIRED') {
        return { success: false, mfaRequired: true, message: 'Multi-Factor Authentication required. Enter your 6-digit TOTP code or recovery code.' };
      }

      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Invalid email or password.' };
      }

      const roleStr = data.user?.role?.toLowerCase() || 'admin';
      const authUser: AuthUser = {
        id: data.user?.userId || `USR-${trimmedEmail.split('@')[0].toUpperCase()}`,
        name: data.user?.fullName || data.user?.email?.split('@')[0] || trimmedEmail.split('@')[0],
        email: data.user?.email || trimmedEmail,
        role: (roleStr === 'admin' ? 'org_admin' : roleStr) as Role,
        organization: 'Acme Enterprise',
        avatarInitials: (data.user?.fullName || trimmedEmail).substring(0, 2).toUpperCase(),
        status: 'active',
        tenantId: data.user?.tenantId || 'TNT-CORP-01',
        token: data.token,
      };

      if (isPlatformBrowser(this.platformId) && data.token) {
        localStorage.setItem('docintel-token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('docintel-refresh-token', data.refreshToken);
        }
      }

      this.setCurrentUser(authUser, rememberMe);
      return { success: true };
    } catch (err: any) {
      // Security Hardening (DEF-009): Disallow client-side auth bypass upon server failure
      return {
        success: false,
        message: err?.message || 'Authentication server unreachable. Please verify network connection.',
      };
    }
  }

  /**
   * Performs silent token refresh via POST /api/v1/auth/refresh (DEF-011)
   */
  async refreshAccessToken(): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const refreshToken = localStorage.getItem('docintel-refresh-token');
    if (!refreshToken) {
      return null;
    }

    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        localStorage.removeItem('docintel-token');
        localStorage.removeItem('docintel-refresh-token');
        return null;
      }

      const data = await res.json();
      if (data?.token) {
        localStorage.setItem('docintel-token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('docintel-refresh-token', data.refreshToken);
        }
        const user = this.currentUser();
        if (user) {
          this.currentUser.set({ ...user, token: data.token });
        }
        return data.token;
      }
      return null;
    } catch (err) {
      console.error('[AuthService] Token refresh network error:', err);
      return null;
    }
  }

  async acceptInvite(token: string, fullName: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch('/api/v1/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Invitation token is invalid or has expired.' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to connect to authentication server.' };
    }
  }

  async enrollMfa(currentCode?: string): Promise<{ success: boolean; secret?: string; otpauthUrl?: string; qrCodeDataUrl?: string; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/auth/mfa/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'MFA enrollment failed.' };
      }
      return {
        success: true,
        secret: data.secret,
        otpauthUrl: data.otpauthUrl,
        qrCodeDataUrl: data.qrCodeDataUrl,
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error during MFA enrollment.' };
    }
  }

  async verifyMfaEnrollment(code: string): Promise<{ success: boolean; recoveryCodes?: string[]; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/auth/mfa/verify-enrollment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Verification failed. Invalid code.' };
      }
      return {
        success: true,
        recoveryCodes: data.recoveryCodes || [],
        message: data.message,
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error verifying MFA code.' };
    }
  }

  async disableMfa(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to disable MFA. Current verification code is invalid.' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error disabling MFA.' };
    }
  }

  async getProfile(): Promise<{ success: boolean; profile?: UserProfileDto; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/users/profile', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to fetch user profile.' };
      }
      return { success: true, profile: data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error fetching profile.' };
    }
  }

  async updateProfile(dto: UpdateProfileDto): Promise<{ success: boolean; profile?: UserProfileDto; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dto),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to update profile.' };
      }
      return { success: true, profile: data.profile, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error updating profile.' };
    }
  }

  async uploadAvatar(file: File): Promise<{ success: boolean; avatarUrl?: string; message?: string }> {
    try {
      const token = this.getAuthToken();
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/v1/users/profile/avatar', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to upload avatar.' };
      }
      return { success: true, avatarUrl: data.avatarUrl, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error uploading avatar.' };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string; revokedSessionsCount?: number }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Password update failed.' };
      }
      return { success: true, message: data.message, revokedSessionsCount: data.revokedSessionsCount };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error changing password.' };
    }
  }

  async getSessions(): Promise<{ success: boolean; sessions?: SessionItemDto[]; total?: number; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch('/api/v1/auth/sessions', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to retrieve active sessions.' };
      }
      return { success: true, sessions: data.sessions || [], total: data.total };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error retrieving sessions.' };
    }
  }

  async revokeSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const token = this.getAuthToken();
      const res = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.title || data.message || 'Failed to terminate session.' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error terminating session.' };
    }
  }

  private getAuthToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('docintel-token') || this.currentUser()?.token || null;
  }

  private setCurrentUser(user: AuthUser, rememberMe: boolean): void {
    this.currentUser.set(user);
    if (isPlatformBrowser(this.platformId)) {
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem(this.storageKey, JSON.stringify(user));
    }
  }

  private getStoredUser(): AuthUser | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const stored =
      localStorage.getItem(this.storageKey) ??
      sessionStorage.getItem(this.storageKey);

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      localStorage.removeItem(this.storageKey);
      sessionStorage.removeItem(this.storageKey);
      return null;
    }
  }
}