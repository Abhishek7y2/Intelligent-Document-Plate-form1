import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './accept-invite.html',
  styleUrl: './accept-invite.scss',
})
export class AcceptInvite implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  // Token is held strictly in memory, never persisted to localStorage/sessionStorage/cookies
  private rawToken: string | null = null;

  name = '';
  password = '';
  confirmPassword = '';
  showPassword = false;

  isLoading = signal(false);
  isSuccess = signal(false);
  errorMessage = signal<string | null>(null);
  passwordPolicyErrors = signal<string[]>([]);

  ngOnInit(): void {
    // Read token from URL query params
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.rawToken = token.trim();
    }

    // D.2: Immediately strip the token from the URL query after reading it
    if (isPlatformBrowser(this.platformId)) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('token')) {
          url.searchParams.delete('token');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }
      } catch {
        // Ignore URL mutation errors
      }
    }

    if (!this.rawToken) {
      this.errorMessage.set('The invitation link is invalid or has expired. Please ask your administrator to send a new invitation.');
    }
  }

  validatePasswordPolicy(): boolean {
    const p = this.password;
    const errors: string[] = [];

    if (p.length < 12) {
      errors.push('Password must be at least 12 characters long.');
    }
    if (!/[A-Z]/.test(p)) {
      errors.push('Must contain at least one uppercase letter (A-Z).');
    }
    if (!/[a-z]/.test(p)) {
      errors.push('Must contain at least one lowercase letter (a-z).');
    }
    if (!/[0-9]/.test(p)) {
      errors.push('Must contain at least one numerical digit (0-9).');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p)) {
      errors.push('Must contain at least one special character.');
    }

    this.passwordPolicyErrors.set(errors);
    return errors.length === 0;
  }

  submitAcceptInvite(): void {
    this.errorMessage.set(null);

    if (!this.rawToken) {
      this.errorMessage.set('The invitation link is invalid or has expired. Please ask your administrator to send a new invitation.');
      return;
    }

    if (!this.name.trim()) {
      this.errorMessage.set('Please enter your full name.');
      return;
    }

    if (!this.validatePasswordPolicy()) {
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isLoading.set(true);

    this.authService.acceptInvite(this.rawToken, this.name.trim(), this.password)
      .then((res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.isSuccess.set(true);
          // Wipe sensitive credentials from memory
          this.rawToken = null;
          this.password = '';
          this.confirmPassword = '';
        } else {
          this.errorMessage.set(res.message || 'The invitation link is invalid or has expired. Please ask your administrator to send a new invitation.');
        }
      })
      .catch((err) => {
        this.isLoading.set(false);
        const status = err?.status;
        if (status === 400 || status === 404 || status === 410) {
          // D.2: Generic message for invalid/expired tokens
          this.errorMessage.set('The invitation link is invalid or has expired. Please ask your administrator to send a new invitation.');
        } else if (err?.error?.message) {
          this.errorMessage.set(err.error.message);
        } else {
          this.errorMessage.set('The invitation link is invalid or has expired. Please ask your administrator to send a new invitation.');
        }
      });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}
