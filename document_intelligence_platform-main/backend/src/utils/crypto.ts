import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

// SHA-256 hash for secure storage of refresh tokens
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate cryptographically random secure token string
export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * AES-256-GCM Authenticated Encryption for high-sensitivity secrets (TOTP secrets).
 * Returns iv:authTag:ciphertext string
 */
export function encryptAesGcm(plainText: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * AES-256-GCM Authenticated Decryption.
 * Verifies authenticity tag before returning plaintext.
 */
export function decryptAesGcm(cipherTextWithTag: string, hexKey: string): string {
  const parts = cipherTextWithTag.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid AES-256-GCM encrypted payload format.');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = Buffer.from(hexKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    };
  }
  return { isValid: true };
}

