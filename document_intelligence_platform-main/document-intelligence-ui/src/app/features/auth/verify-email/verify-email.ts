import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmailValidator } from '../../../core/validators';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit, OnDestroy {
  // View states: 'email' (Step 1) -> 'otp' (Step 2) -> routes to /dashboard
  viewMode: 'email' | 'otp' = 'email';

  // Email state
  email = 'abhishek.yadav@acmecorp.com';
  emailError: string | null = null;
  emailTouched = false;
  emailValid = true;

  // OTP state
  otpDigits: string[] = ['', '', '', '', '', ''];
  activeOtpIndex = 0;
  otpError: string | null = null;
  otpSuccessNotice = '';
  resendCountdown = 28;
  canResend = false;
  private timerInterval: any = null;
  demoOtpCode = '742918';

  // Lockout & Expiry States
  otpAttempts = 0;
  isOtpLockedOut = false;
  lockoutTimeLeft = 0;
  private lockoutTimer: any = null;

  // MFA Authenticator Modal toggle
  showAuthenticatorModal = false;

  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    // If an email was passed in query params (e.g. from login page)
    this.route.queryParams.subscribe((params) => {
      if (params['email']) {
        this.email = params['email'];
        this.validateEmail();
      }
      // If directly requested step=otp, start at otp, otherwise start at email step
      if (params['step'] === 'otp') {
        this.viewMode = 'otp';
        this.focusFirstOtp();
      } else {
        this.viewMode = 'email';
      }
    });

    this.startResendTimer();
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
    }
  }

  focusFirstOtp(): void {
    setTimeout(() => {
      const firstInput = document.getElementById('otp-0');
      if (firstInput) {
        firstInput.focus();
      }
    }, 150);
  }

  changeEmail(): void {
    this.viewMode = 'email';
    this.otpDigits = ['', '', '', '', '', ''];
    this.otpError = null;
  }

  toggleAuthenticator(): void {
    this.showAuthenticatorModal = !this.showAuthenticatorModal;
  }

  selectQuickEmail(selected: string): void {
    this.email = selected;
    this.validateEmail();
  }

  // --- Step 1: Email Validation & Request OTP ---

  validateEmail(): boolean {
    const result = EmailValidator.validate(this.email);
    this.emailError = result.isValid ? null : result.error;
    this.emailValid = result.isValid;
    return result.isValid;
  }

  onEmailChange(): void {
    if (this.emailTouched) {
      this.validateEmail();
    }
  }

  onEmailBlur(): void {
    this.emailTouched = true;
    this.validateEmail();
  }

  sendOtp(): void {
    this.emailTouched = true;
    this.errorMessage = '';

    if (!this.email || !this.email.includes('@')) {
      this.emailError = 'Please enter a valid work email address.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = false;
    this.viewMode = 'otp';
    this.otpError = null;
    this.otpSuccessNotice = `A 6-digit verification code has been sent to ${this.email}`;
    this.startResendTimer();
    this.focusFirstOtp();
    this.cdr.markForCheck();
  }

  // --- Step 2: OTP Handling & Verification ---

  get fullOtp(): string {
    return this.otpDigits.join('');
  }

  onOtpInput(event: Event, index: number): void {
    if (this.isOtpLockedOut) return;
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Only allow single digit
    if (value && !/^\d$/.test(value)) {
      this.otpDigits[index] = '';
      return;
    }

    this.otpDigits[index] = value;
    this.otpError = null;

    // Auto-advance to next input box if a digit was entered
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        this.activeOtpIndex = index + 1;
        nextInput.focus();
        nextInput.select();
      }
    }

    // Auto-submit if all 6 digits entered
    if (this.fullOtp.length === 6) {
      this.verifyOtp();
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    if (this.isOtpLockedOut) return;
    // Handle backspace navigation
    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
        if (prevInput) {
          this.activeOtpIndex = index - 1;
          prevInput.focus();
          prevInput.select();
        }
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      if (prevInput) {
        this.activeOtpIndex = index - 1;
        prevInput.focus();
      }
    } else if (event.key === 'ArrowRight' && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        this.activeOtpIndex = index + 1;
        nextInput.focus();
      }
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    if (this.isOtpLockedOut) return;
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const cleanDigits = pastedData.replace(/\D/g, '').slice(0, 6);

    if (cleanDigits.length > 0) {
      for (let i = 0; i < 6; i++) {
        this.otpDigits[i] = cleanDigits[i] || '';
      }
      this.otpError = null;
      if (cleanDigits.length === 6) {
        this.verifyOtp();
      } else {
        const nextIndex = Math.min(cleanDigits.length, 5);
        this.activeOtpIndex = nextIndex;
        const targetInput = document.getElementById(`otp-${nextIndex}`);
        if (targetInput) targetInput.focus();
      }
    }
  }

  fillDemoOtp(): void {
    if (this.isOtpLockedOut) return;
    for (let i = 0; i < 6; i++) {
      this.otpDigits[i] = this.demoOtpCode[i] || '';
    }
    this.otpError = null;
    this.verifyOtp();
  }

  startResendTimer(): void {
    this.clearResendTimer();
    this.resendCountdown = 28;
    this.canResend = false;

    this.timerInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.canResend = true;
        this.clearResendTimer();
      }
    }, 1000);
  }

  clearResendTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  resendOtp(): void {
    if (!this.canResend || this.isOtpLockedOut) return;

    this.otpDigits = ['', '', '', '', '', ''];
    this.otpError = null;
    this.otpSuccessNotice = 'A new 6-digit verification code has been sent.';
    this.startResendTimer();
  }

  verifyOtp(): void {
    if (this.isOtpLockedOut) return;

    if (this.fullOtp.length < 6) {
      this.otpError = 'Please enter the complete 6-digit verification code.';
      this.cdr.markForCheck();
      return;
    }

    this.otpError = null;

    if (this.fullOtp === this.demoOtpCode || /^\d{6}$/.test(this.fullOtp)) {
      this.otpAttempts = 0;
      this.authService.loginByEmail(this.email);
      this.router.navigate(['/dashboard']);
    } else {
      this.otpAttempts++;
      if (this.otpAttempts >= 5) {
        this.isOtpLockedOut = true;
        this.lockoutTimeLeft = 60;
        this.otpError = 'Maximum OTP verification attempts exceeded (5 failed tries). Locked out for 60 seconds.';

        this.lockoutTimer = setInterval(() => {
          this.lockoutTimeLeft--;
          if (this.lockoutTimeLeft <= 0) {
            clearInterval(this.lockoutTimer);
            this.isOtpLockedOut = false;
            this.otpAttempts = 0;
            this.otpError = null;
          }
          this.cdr.markForCheck();
        }, 1000);
      } else {
        this.otpError = `Invalid verification code. Attempt ${this.otpAttempts} of 5.`;
      }
      this.cdr.markForCheck();
    }
  }
}
