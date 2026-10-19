import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { Role, DEMO_ROLES } from '../../../core/models/roles';
import { EmailValidator, PasswordValidator } from '../../../core/validators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;

  // Authentication Modes (Password vs SMTP-delivered OTP)
  authMode: 'password' | 'otp' = 'password';
  otpCode = '';
  otpSent = false;
  otpSending = false;
  otpSuccessMessage = '';
  smtpStatus: { configured: boolean; host: string; port: number; secure: boolean; from: string } | null = null;

  // Validation States
  emailError: string | null = null;
  emailTouched = false;
  emailValid = false;

  passwordError: string | null = null;
  passwordTouched = false;
  passwordValid = false;

  isSubmitted = false;
  isLoading = false;
  errorMessage = '';

  // Security & Connectivity States (BRD Section 13)
  demoRoles = DEMO_ROLES;
  failedAttempts = 0;
  isLockedOut = false;
  lockoutSecondsLeft = 0;
  private lockoutInterval: any;

  isRateLimited = false;
  isOffline = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isOffline = !navigator.onLine;
      window.addEventListener('online', this.updateOnlineStatus);
      window.addEventListener('offline', this.updateOnlineStatus);

      this.authService.getSmtpStatus().then((status) => {
        this.smtpStatus = status;
      });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('online', this.updateOnlineStatus);
      window.removeEventListener('offline', this.updateOnlineStatus);
    }
    if (this.lockoutInterval) {
      clearInterval(this.lockoutInterval);
    }
  }

  private updateOnlineStatus = (): void => {
    if (isPlatformBrowser(this.platformId)) {
      this.isOffline = !navigator.onLine;
    }
  };

  validateEmail(isRealtime = false): boolean {
    if (isRealtime && !this.emailTouched && !this.isSubmitted) {
      return true;
    }
    const result = EmailValidator.validate(this.email);
    this.emailError = result.isValid ? null : result.error;
    this.emailValid = result.isValid;
    return result.isValid;
  }

  onEmailChange(): void {
    if (this.emailTouched || this.isSubmitted) {
      this.validateEmail(true);
    }
  }

  onEmailBlur(): void {
    this.emailTouched = true;
    this.validateEmail(false);
  }

  validatePassword(isRealtime = false): boolean {
    if (isRealtime && !this.passwordTouched && !this.isSubmitted) {
      return true;
    }
    const result = PasswordValidator.validateLoginPassword(this.password);
    this.passwordError = result.isValid ? null : result.error;
    this.passwordValid = result.isValid;
    return result.isValid;
  }

  onPasswordChange(): void {
    if (this.passwordTouched || this.isSubmitted) {
      this.validatePassword(true);
    }
  }

  onPasswordBlur(): void {
    this.passwordTouched = true;
    this.validatePassword(false);
  }

  // D.3: MFA Step State
  mfaRequired = false;
  mfaCode = '';

  cancelMfa(): void {
    this.mfaRequired = false;
    this.mfaCode = '';
    this.errorMessage = '';
  }

  async login(): Promise<void> {
    if (this.isLoading || this.isLockedOut || this.isOffline) {
      return;
    }

    this.isSubmitted = true;
    this.emailTouched = true;
    this.passwordTouched = true;
    this.errorMessage = '';

    const isEmailValid = this.validateEmail(false);
    const isPasswordValid = this.validatePassword(false);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    if (this.mfaRequired && !this.mfaCode.trim()) {
      this.errorMessage = 'Please enter your 6-digit MFA code or recovery code.';
      return;
    }

    this.isLoading = true;

    try {
      const res = await this.authService.loginApi(
        this.email,
        this.password,
        this.mfaRequired ? this.mfaCode.trim() : undefined,
        this.rememberMe
      );

      this.isLoading = false;

      if (res.mfaRequired) {
        this.mfaRequired = true;
        this.errorMessage = res.message || 'Two-Factor Authentication required.';
        return;
      }

      if (res.success) {
        this.failedAttempts = 0;
        this.router.navigate(['/dashboard']);
      } else {
        this.failedAttempts++;
        if (this.failedAttempts >= 5) {
          this.triggerLockout();
        } else {
          this.errorMessage = res.message || `Invalid credentials. Attempt ${this.failedAttempts} of 5 before account lockout.`;
        }
      }
    } catch (err: any) {
      this.isLoading = false;
      this.errorMessage = err?.message || 'Authentication error.';
    }
  }

  private triggerLockout(): void {
    this.isLockedOut = true;
    this.lockoutSecondsLeft = 60; // 60s lockout
    this.errorMessage = 'Account locked due to 5 consecutive failed login attempts.';

    if (this.lockoutInterval) {
      clearInterval(this.lockoutInterval);
    }

    this.lockoutInterval = setInterval(() => {
      this.lockoutSecondsLeft--;
      if (this.lockoutSecondsLeft <= 0) {
        clearInterval(this.lockoutInterval);
        this.isLockedOut = false;
        this.failedAttempts = 0;
        this.errorMessage = '';
      }
    }, 1000);
  }

  selectRole(roleEmail: string): void {
    if (this.isLockedOut) {
      this.isLockedOut = false;
      this.failedAttempts = 0;
      this.lockoutSecondsLeft = 0;
      if (this.lockoutInterval) {
        clearInterval(this.lockoutInterval);
      }
    }
    this.email = roleEmail;
    this.errorMessage = '';
    this.emailError = null;
    this.passwordError = null;
    this.emailValid = true;
    this.passwordValid = true;
    this.emailTouched = true;
    this.passwordTouched = true;
  }

  selectRoleByObject(role: Role, email: string): void {
    if (this.isLockedOut) return;
    this.selectRole(email);
  }

  loginWithSso(): void {
    if (this.isLockedOut) return;
    this.selectRole('admin@docnexa.io');
    this.login();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  setAuthMode(mode: 'password' | 'otp'): void {
    this.authMode = mode;
    this.errorMessage = '';
    this.otpSuccessMessage = '';
  }

  async requestEmailOtp(): Promise<void> {
    if (this.isLockedOut || this.isOffline || this.otpSending) return;
    this.emailTouched = true;
    this.errorMessage = '';
    this.otpSuccessMessage = '';

    const isEmailValid = this.validateEmail(false);
    if (!isEmailValid) {
      return;
    }

    this.otpSending = true;
    try {
      const res = await this.authService.requestOtp(this.email);
      this.otpSending = false;
      if (res.success) {
        this.otpSent = true;
        this.otpSuccessMessage = res.message;
        if (res.testOtp) {
          this.otpCode = res.testOtp;
        }
      } else {
        this.errorMessage = res.message || 'Unable to dispatch verification code via SMTP.';
      }
    } catch (err: any) {
      this.otpSending = false;
      this.errorMessage = err.message || 'Error communicating with SMTP service.';
    }
  }

  async verifyOtpAndLogin(): Promise<void> {
    if (this.isLoading || this.isLockedOut || this.isOffline) return;
    this.errorMessage = '';

    if (!this.otpCode || this.otpCode.trim().length < 6) {
      this.errorMessage = 'Please enter the 6-digit verification code sent to your email.';
      return;
    }

    this.isLoading = true;
    try {
      const res = await this.authService.verifyOtpAndLogin(this.email, this.otpCode.trim());
      this.isLoading = false;
      if (res.success) {
        this.failedAttempts = 0;
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = res.message || 'Invalid or expired verification code.';
      }
    } catch (err: any) {
      this.isLoading = false;
      this.errorMessage = err.message || 'Verification failed.';
    }
  }
}