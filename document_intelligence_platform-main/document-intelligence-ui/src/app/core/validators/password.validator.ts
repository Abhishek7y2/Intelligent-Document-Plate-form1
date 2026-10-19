/**
 * Enterprise Password Validator
 * Supports login authentication validation and enterprise password policy verification.
 */

import { ValidationResult } from './email.validator';

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export class PasswordValidator {
  private static readonly MIN_LOGIN_LENGTH = 6;
  private static readonly MIN_POLICY_LENGTH = 12;
  private static readonly MAX_LENGTH = 128;

  /**
   * Validates password for Login / Sign-in context.
   */
  public static validateLoginPassword(password: string | null | undefined): ValidationResult {
    if (!password || password.trim() === '') {
      return {
        isValid: false,
        error: 'Password is required.',
      };
    }

    if (password.length > this.MAX_LENGTH) {
      return {
        isValid: false,
        error: `Password cannot exceed ${this.MAX_LENGTH} characters.`,
      };
    }

    if (password.length < this.MIN_LOGIN_LENGTH) {
      return {
        isValid: false,
        error: `Password must be at least ${this.MIN_LOGIN_LENGTH} characters.`,
      };
    }

    return {
      isValid: true,
      error: null,
    };
  }

  /**
   * Validates password against enterprise complexity policy.
   */
  public static validatePolicy(password: string | null | undefined): ValidationResult {
    if (!password || password.trim() === '') {
      return {
        isValid: false,
        error: 'Password is required.',
      };
    }

    if (password.trim() !== password) {
      return {
        isValid: false,
        error: 'Password cannot have leading or trailing spaces.',
      };
    }

    if (password.length < this.MIN_POLICY_LENGTH) {
      return {
        isValid: false,
        error: `Password must be at least ${this.MIN_POLICY_LENGTH} characters long.`,
      };
    }

    if (password.length > this.MAX_LENGTH) {
      return {
        isValid: false,
        error: `Password cannot exceed ${this.MAX_LENGTH} characters.`,
      };
    }

    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must include at least one uppercase letter.',
      };
    }

    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must include at least one lowercase letter.',
      };
    }

    if (!/[0-9]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must include at least one number.',
      };
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must include at least one special character (!@#$%^&*...).',
      };
    }

    return {
      isValid: true,
      error: null,
    };
  }

  /**
   * Calculates password strength score and criteria fulfillment.
   */
  public static calculateStrength(password: string): PasswordStrength {
    const val = password || '';
    const hasMinLength = val.length >= this.MIN_POLICY_LENGTH;
    const hasUppercase = /[A-Z]/.test(val);
    const hasLowercase = /[a-z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(val);

    let score = 0;
    if (val.length >= 8) score++;
    if (hasMinLength) score++;
    if (hasUppercase && hasLowercase) score++;
    if (hasNumber && hasSpecialChar) score++;

    let label: 'Weak' | 'Fair' | 'Strong' | 'Very Strong' = 'Weak';
    if (score === 2) label = 'Fair';
    else if (score === 3) label = 'Strong';
    else if (score >= 4) label = 'Very Strong';

    return {
      score,
      label,
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
    };
  }
}
