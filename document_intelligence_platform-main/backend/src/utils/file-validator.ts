import crypto from 'crypto';
import path from 'path';
import { FileValidationResult } from '../models/intake.models.js';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (BRD FR-001)
export const MIN_FILE_SIZE_BYTES = 1; // Disallow empty files

export interface SupportedTypeInfo {
  mime: string;
  extension: string;
  magicBytes: number[][]; // Multiple acceptable signatures
}

export const ALLOWED_FILE_TYPES: Record<string, SupportedTypeInfo> = {
  'application/pdf': {
    mime: 'application/pdf',
    extension: 'pdf',
    magicBytes: [[0x25, 0x50, 0x44, 0x46, 0x2D]], // %PDF-
  },
  'image/png': {
    mime: 'image/png',
    extension: 'png',
    magicBytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // \x89PNG\r\n\x1a\n
  },
  'image/jpeg': {
    mime: 'image/jpeg',
    extension: 'jpg',
    magicBytes: [[0xFF, 0xD8, 0xFF]], // Standard JPEG SOI
  },
  'image/tiff': {
    mime: 'image/tiff',
    extension: 'tiff',
    magicBytes: [
      [0x49, 0x49, 0x2A, 0x00], // II*\0 (Intel little-endian)
      [0x4D, 0x4D, 0x00, 0x2A], // MM\0* (Motorola big-endian)
    ],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    magicBytes: [[0x50, 0x4B, 0x03, 0x04]], // PK\x03\x04 (ZIP container)
  },
};

/**
 * Detect file MIME type from magic byte signatures
 */
export function detectMimeFromBuffer(buffer: Buffer): { mime: string; extension: string } | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  for (const [mimeKey, info] of Object.entries(ALLOWED_FILE_TYPES)) {
    for (const signature of info.magicBytes) {
      if (buffer.length >= signature.length) {
        let match = true;
        for (let i = 0; i < signature.length; i++) {
          if (buffer[i] !== signature[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          return { mime: mimeKey, extension: info.extension };
        }
      }
    }
  }

  return null;
}

/**
 * Sanitize filename to prevent directory traversal and shell injection
 */
export function sanitizeFileName(originalName: string): string {
  if (!originalName || originalName.trim().length === 0) {
    return 'document.bin';
  }

  // 1. Strip all directory paths (both POSIX and Windows separators)
  const baseName = path.basename(originalName.replace(/\\/g, '/'));

  // 2. Remove null bytes and non-printable control characters
  const cleanBase = baseName.replace(/[\x00-\x1F\x7F]/g, '');

  // 3. Remove leading periods to prevent hidden file attacks
  const noHidden = cleanBase.replace(/^\.+/, '');

  // 4. Sanitize special characters, keeping alphanumeric, hyphens, underscores, and single dot for ext
  const sanitized = noHidden.replace(/[^a-zA-Z0-9._-]/g, '_');

  return sanitized.length > 0 ? sanitized.substring(0, 255) : 'document.bin';
}

/**
 * Compute SHA-256 hash of a buffer
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate a server-controlled, deterministic storage key preventing path traversal
 */
export function generateStorageKey(tenantId: string, documentId: string, extension: string): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, '');
  return `tenants/${safeTenant}/raw/${safeDocId}.${safeExt}`;
}

/**
 * Comprehensive pre-flight file validation
 */
export function validateUploadFile(
  buffer: Buffer,
  declaredMimeType: string,
  _originalFilename: string
): FileValidationResult {
  // 1. Check size limits
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      mimeType: declaredMimeType,
      detectedExtension: '',
      sha256Hash: '',
      sizeBytes: 0,
      error: 'Uploaded file is empty (0 bytes).',
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      mimeType: declaredMimeType,
      detectedExtension: '',
      sha256Hash: '',
      sizeBytes: buffer.length,
      error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 50 MB.`,
    };
  }

  // 2. Detect magic bytes
  const detected = detectMimeFromBuffer(buffer);
  if (!detected) {
    return {
      valid: false,
      mimeType: declaredMimeType,
      detectedExtension: '',
      sha256Hash: computeSha256(buffer),
      sizeBytes: buffer.length,
      error: 'File signature (magic bytes) does not match any approved format (PDF, PNG, JPEG, TIFF, DOCX).',
    };
  }

  // 3. Compare with declared MIME type (allowing case-insensitivity)
  const normalizedDeclared = (declaredMimeType || '').toLowerCase().trim();
  // Map common client MIME aliases
  const normalizedTarget = normalizedDeclared === 'image/jpg' ? 'image/jpeg' : normalizedDeclared;

  if (normalizedTarget && normalizedTarget !== detected.mime) {
    return {
      valid: false,
      mimeType: detected.mime,
      detectedExtension: detected.extension,
      sha256Hash: computeSha256(buffer),
      sizeBytes: buffer.length,
      error: `MIME type mismatch: declared '${declaredMimeType}' but magic byte verification identified '${detected.mime}'.`,
    };
  }

  // 4. Compute SHA-256 hash
  const sha256Hash = computeSha256(buffer);

  return {
    valid: true,
    mimeType: detected.mime,
    detectedExtension: detected.extension,
    sha256Hash,
    sizeBytes: buffer.length,
  };
}
