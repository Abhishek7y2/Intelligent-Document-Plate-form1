import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AcceptInvite } from './accept-invite/accept-invite';
import { Login } from './login/login';
import { AuthService } from '../../core/services/auth.service';

describe('Sprint 7 Auth Security Gaps Spec (Part 0.5)', () => {
  describe('1. Accept Invite Page — Immediate URL Token Stripping', () => {
    let component: AcceptInvite;
    let mockRoute: any;
    let mockRouter: any;
    let mockAuthService: any;

    beforeEach(() => {
      mockRoute = {
        snapshot: {
          queryParamMap: {
            get: vi.fn().mockImplementation((param: string) => {
              if (param === 'token') return 'SECURE_INVITE_TOKEN_12345';
              return null;
            }),
          },
        },
      };

      mockRouter = {
        navigate: vi.fn(),
      };

      mockAuthService = {
        acceptInvite: vi.fn(),
      };

      const injector = Injector.create({
        providers: [
          { provide: ActivatedRoute, useValue: mockRoute },
          { provide: Router, useValue: mockRouter },
          { provide: AuthService, useValue: mockAuthService },
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });

      component = runInInjectionContext(injector, () => new AcceptInvite());
    });

    it('reads token into memory and removes it from the browser URL immediately', () => {
      // Set the window URL to include the token parameter
      window.history.pushState({}, '', '/accept-invite?token=SECURE_INVITE_TOKEN_12345');

      // Spy on history.replaceState
      const replaceSpy = vi.spyOn(window.history, 'replaceState');

      // Initialize component
      component.ngOnInit();

      // Ensure token is stored in memory
      expect((component as any).rawToken).toBe('SECURE_INVITE_TOKEN_12345');

      // Ensure replaceState was called to sanitize URL
      expect(replaceSpy).toHaveBeenCalled();

      replaceSpy.mockRestore();
    });

    it('enforces strong password policy before submission', () => {
      component.password = 'weak';
      component.confirmPassword = 'weak';

      const isValid = component.validatePasswordPolicy();
      expect(isValid).toBe(false);
      expect(component.passwordPolicyErrors().length).toBeGreaterThan(0);

      // Strong compliant password
      component.password = 'P@ssw0rdSecure2026!';
      component.confirmPassword = 'P@ssw0rdSecure2026!';
      const isValidStrong = component.validatePasswordPolicy();
      expect(isValidStrong).toBe(true);
      expect(component.passwordPolicyErrors().length).toBe(0);
    });
  });

  describe('2. MFA Login & Verification Flow', () => {
    let component: Login;
    let mockRouter: any;
    let mockAuthService: any;

    beforeEach(() => {
      mockRouter = {
        navigate: vi.fn(),
      };

      mockAuthService = {
        loginApi: vi.fn(),
      };

      const injector = Injector.create({
        providers: [
          { provide: Router, useValue: mockRouter },
          { provide: AuthService, useValue: mockAuthService },
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });

      component = runInInjectionContext(injector, () => new Login());
    });

    it('prompts for MFA step when backend responds mfaRequired=true', async () => {
      component.email = 'security-lead@docunexa.enterprise';
      component.password = 'ValidPassword123!';

      mockAuthService.loginApi.mockResolvedValue({
        success: false,
        mfaRequired: true,
        message: 'Two-Factor Authentication required.',
      });

      await component.login();

      expect(component.mfaRequired).toBe(true);
      expect(component.errorMessage).toContain('Two-Factor Authentication required');
    });

    it('submits MFA code and navigates to dashboard on successful verification', async () => {
      component.email = 'security-lead@docunexa.enterprise';
      component.password = 'ValidPassword123!';
      component.mfaRequired = true;
      component.mfaCode = '123456';

      mockAuthService.loginApi.mockResolvedValue({
        success: true,
        mfaRequired: false,
      });

      await component.login();

      expect(mockAuthService.loginApi).toHaveBeenCalledWith(
        'security-lead@docunexa.enterprise',
        'ValidPassword123!',
        '123456',
        false
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('cancels MFA returning to standard password entry', () => {
      component.mfaRequired = true;
      component.mfaCode = '123456';
      component.errorMessage = 'MFA step';

      component.cancelMfa();

      expect(component.mfaRequired).toBe(false);
      expect(component.mfaCode).toBe('');
      expect(component.errorMessage).toBe('');
    });
  });
});
