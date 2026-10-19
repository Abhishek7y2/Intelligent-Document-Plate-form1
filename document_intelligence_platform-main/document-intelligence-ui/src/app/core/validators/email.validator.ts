/**
 * Enterprise Email Validator
 * Implements strict RFC 5321 / RFC 5322 compliant client-side validation rules.
 */

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

export class EmailValidator {
  private static readonly MAX_EMAIL_LENGTH = 254;
  private static readonly MAX_LOCAL_PART_LENGTH = 64;

  /**
   * Validates an email address against enterprise criteria.
   * Provides user-friendly, actionable error messages without exposing regex internals.
   */
  public static validate(email: string | null | undefined): ValidationResult {
    // 1. Required & Null/Undefined check
    if (email === null || email === undefined || email.trim() === '') {
      return {
        isValid: false,
        error: 'Email address is required.',
      };
    }

    const trimmed = email.trim();

    // 2. Whitespace check inside email
    if (/\s/.test(trimmed)) {
      return {
        isValid: false,
        error: 'Email address cannot contain spaces.',
      };
    }

    // 3. Overall length check (RFC 5321 max 254 octets)
    if (trimmed.length > this.MAX_EMAIL_LENGTH) {
      return {
        isValid: false,
        error: `Email address cannot exceed ${this.MAX_EMAIL_LENGTH} characters.`,
      };
    }

    // 4. Exactly one '@' symbol
    const atParts = trimmed.split('@');
    if (atParts.length !== 2) {
      return {
        isValid: false,
        error: 'Please enter a valid email address containing exactly one "@".',
      };
    }

    const [localPart, domainPart] = atParts;

    // 5. Local part validation
    if (!localPart || localPart.length === 0) {
      return {
        isValid: false,
        error: 'Email username part before "@" cannot be empty.',
      };
    }

    if (localPart.length > this.MAX_LOCAL_PART_LENGTH) {
      return {
        isValid: false,
        error: `Username portion before "@" cannot exceed ${this.MAX_LOCAL_PART_LENGTH} characters.`,
      };
    }

    if (localPart.startsWith('.')) {
      return {
        isValid: false,
        error: 'Email address cannot start with a dot.',
      };
    }

    if (localPart.endsWith('.')) {
      return {
        isValid: false,
        error: 'Email address username cannot end with a dot before "@".',
      };
    }

    if (localPart.includes('..')) {
      return {
        isValid: false,
        error: 'Email address cannot contain consecutive dots.',
      };
    }

    // Allowed local-part characters: letters, numbers, dot, plus, hyphen, underscore, percent
    const validLocalRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
    if (!validLocalRegex.test(localPart)) {
      return {
        isValid: false,
        error: 'Email address contains invalid characters.',
      };
    }

    // 6. Domain part validation
    if (!domainPart || domainPart.length === 0) {
      return {
        isValid: false,
        error: 'Email domain portion after "@" is missing.',
      };
    }

    if (domainPart.startsWith('.')) {
      return {
        isValid: false,
        error: 'Email domain cannot start with a dot.',
      };
    }

    if (domainPart.endsWith('.')) {
      return {
        isValid: false,
        error: 'Email domain cannot end with a dot.',
      };
    }

    if (domainPart.includes('..')) {
      return {
        isValid: false,
        error: 'Email domain cannot contain consecutive dots.',
      };
    }

    const domainLabels = domainPart.split('.');
    if (domainLabels.length < 2) {
      return {
        isValid: false,
        error: 'Please enter a complete domain (e.g., company.com).',
      };
    }

    for (const label of domainLabels) {
      if (!label || label.length === 0) {
        return {
          isValid: false,
          error: 'Please enter a valid domain name.',
        };
      }

      if (label.length > 63) {
        return {
          isValid: false,
          error: 'Domain section exceeds maximum 63 characters.',
        };
      }

      if (label.startsWith('-') || label.endsWith('-')) {
        return {
          isValid: false,
          error: 'Domain parts cannot start or end with a hyphen.',
        };
      }

      // Domain labels must be alphanumeric and hyphens
      if (!/^[a-zA-Z0-9-]+$/.test(label)) {
        return {
          isValid: false,
          error: 'Domain contains invalid characters.',
        };
      }
    }

    // 7. Top-Level Domain (TLD) validation: at least 2 alphabetic characters
    const tld = domainLabels[domainLabels.length - 1];
    if (!/^[a-zA-Z]{2,}$/.test(tld)) {
      return {
        isValid: false,
        error: 'Please enter a valid top-level domain (e.g., .com, .org, .co.in).',
      };
    }

    return {
      isValid: true,
      error: null,
    };
  }

  /**
   * Safely normalizes email by trimming and converting to lowercase.
   */
  public static normalize(email: string): string {
    if (!email) return '';
    return email.trim().toLowerCase();
  }
}
