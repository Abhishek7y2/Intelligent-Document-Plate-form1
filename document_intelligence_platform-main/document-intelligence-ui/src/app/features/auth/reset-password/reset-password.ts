import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

export interface PasswordRule {
  key: string;
  label: string;
  passed: boolean;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss'],
})
export class ResetPassword implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = '';
  isTokenValid = true;
  isExpired = false;
  isSubmitted = false;
  isLoading = false;

  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  rules: PasswordRule[] = [
    { key: 'length', label: 'Minimum 12 characters', passed: false },
    { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', passed: false },
    { key: 'lowercase', label: 'At least one lowercase letter (a-z)', passed: false },
    { key: 'number', label: 'At least one number (0-9)', passed: false },
    { key: 'symbol', label: 'At least one special symbol (!@#$%^&*)', passed: false },
  ];

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';

    // Mock token verification: token "expired" triggers expired state, empty/invalid token triggers invalid state
    if (this.token === 'expired') {
      this.isExpired = true;
      this.isTokenValid = false;
    } else if (!this.token || this.token === 'invalid') {
      this.isTokenValid = false;
    }
  }

  onPasswordInput(): void {
    this.rules[0].passed = this.newPassword.length >= 12;
    this.rules[1].passed = /[A-Z]/.test(this.newPassword);
    this.rules[2].passed = /[a-z]/.test(this.newPassword);
    this.rules[3].passed = /[0-9]/.test(this.newPassword);
    this.rules[4].passed = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.newPassword);
  }

  get strengthScore(): number {
    return this.rules.filter((r) => r.passed).length;
  }

  get strengthLabel(): string {
    const score = this.strengthScore;
    if (score <= 1) return 'Weak';
    if (score <= 3) return 'Moderate';
    if (score === 4) return 'Strong';
    return 'Very Strong';
  }

  get strengthPercentage(): number {
    return (this.strengthScore / 5) * 100;
  }

  get isFormValid(): boolean {
    return (
      this.strengthScore === 5 &&
      this.newPassword === this.confirmPassword &&
      this.confirmPassword.length > 0
    );
  }

  onSubmit(): void {
    if (!this.isFormValid) return;

    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.isSubmitted = true;
    }, 1000);
  }

  requestNewLink(): void {
    this.router.navigate(['/verify-email']);
  }
}
