import {
  detectMimeFromBuffer,
  validateUploadFile,
  sanitizeFileName,
  computeSha256,
  generateStorageKey,
  MAX_FILE_SIZE_BYTES,
} from './file-validator.js';

describe('Sprint 4: File Validation & Magic Bytes Security', () => {
  // Synthetic Fixtures
  const validPdfHeader = Buffer.from('%PDF-1.7\nSample PDF payload stream');
  const validPngHeader = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('PNG_DATA')]);
  const validJpgHeader = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JPEG_DATA')]);
  const validTiffLE = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.from('TIFF_LE_DATA')]);
  const validTiffBE = Buffer.concat([Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), Buffer.from('TIFF_BE_DATA')]);
  const validDocxHeader = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('ZIP_DOCX_DATA')]);
  const fakeExeHeader = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.from('MALICIOUS_EXE')]);

  describe('detectMimeFromBuffer()', () => {
    it('should accurately identify PDF magic bytes (%PDF-)', () => {
      const result = detectMimeFromBuffer(validPdfHeader);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('application/pdf');
      expect(result?.extension).toBe('pdf');
    });

    it('should accurately identify PNG magic bytes', () => {
      const result = detectMimeFromBuffer(validPngHeader);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('image/png');
      expect(result?.extension).toBe('png');
    });

    it('should accurately identify JPEG magic bytes', () => {
      const result = detectMimeFromBuffer(validJpgHeader);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('image/jpeg');
      expect(result?.extension).toBe('jpg');
    });

    it('should accurately identify TIFF magic bytes (both Little-Endian and Big-Endian)', () => {
      const leResult = detectMimeFromBuffer(validTiffLE);
      expect(leResult?.mime).toBe('image/tiff');
      expect(leResult?.extension).toBe('tiff');

      const beResult = detectMimeFromBuffer(validTiffBE);
      expect(beResult?.mime).toBe('image/tiff');
      expect(beResult?.extension).toBe('tiff');
    });

    it('should accurately identify DOCX magic bytes (PK Zip header)', () => {
      const result = detectMimeFromBuffer(validDocxHeader);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(result?.extension).toBe('docx');
    });

    it('should return null for unsupported magic bytes (e.g. Windows PE Executable MZ)', () => {
      const result = detectMimeFromBuffer(fakeExeHeader);
      expect(result).toBeNull();
    });

    it('should return null for buffers shorter than 4 bytes', () => {
      const result = detectMimeFromBuffer(Buffer.from([0x25, 0x50]));
      expect(result).toBeNull();
    });
  });

  describe('validateUploadFile() Comprehensive Checks', () => {
    it('should accept valid PDF file matching declared MIME', () => {
      const res = validateUploadFile(validPdfHeader, 'application/pdf', 'invoice_2026.pdf');
      expect(res.valid).toBe(true);
      expect(res.mimeType).toBe('application/pdf');
      expect(res.detectedExtension).toBe('pdf');
      expect(res.sizeBytes).toBe(validPdfHeader.length);
      expect(res.sha256Hash).toBeDefined();
      expect(res.sha256Hash.length).toBe(64);
    });

    it('should reject empty files (0 bytes)', () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = validateUploadFile(emptyBuffer, 'application/pdf', 'empty.pdf');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/empty/i);
    });

    it('should reject oversized files (> 50 MB)', () => {
      const oversizedMock = { length: MAX_FILE_SIZE_BYTES + 1024 } as unknown as Buffer;
      const res = validateUploadFile(oversizedMock, 'application/pdf', 'huge.pdf');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds/i);
    });

    it('should reject MIME/signature mismatches (spoofed extension)', () => {
      // Buffer has PNG magic bytes, but client claims it is application/pdf
      const res = validateUploadFile(validPngHeader, 'application/pdf', 'disguised.pdf');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/mismatch/i);
    });

    it('should reject executable files disguised as PDF', () => {
      const res = validateUploadFile(fakeExeHeader, 'application/pdf', 'trojan.pdf');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/does not match any approved format/i);
    });

    it('should reject when declared MIME is not on the supported allowlist', () => {
      const res = validateUploadFile(validPdfHeader, 'application/x-sh', 'script.sh');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/mismatch/i);
    });
  });

  describe('Path Traversal & Filename Sanitization', () => {
    it('should strip directory traversal sequences (../, ..\\)', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFileName('../../../var/log/doc.pdf')).toBe('doc.pdf');
    });

    it('should strip null bytes and unsafe characters', () => {
      expect(sanitizeFileName('exploit\0.pdf')).toBe('exploit.pdf');
      expect(sanitizeFileName('bad;rm -rf test.pdf')).toBe('bad_rm_-rf_test.pdf');
    });

    it('should fallback to document.bin for blank or unsafe root names', () => {
      expect(sanitizeFileName('')).toBe('document.bin');
      expect(sanitizeFileName('...')).toBe('document.bin');
      expect(sanitizeFileName('   ')).toBe('document.bin');
    });

    it('should generate server-controlled storage keys with tenant fencing', () => {
      const key = generateStorageKey('TNT-CORP-01', 'DOC-999', 'pdf');
      expect(key).toBe('tenants/TNT-CORP-01/raw/DOC-999.pdf');
      expect(key).not.toContain('..');
    });
  });

  describe('SHA-256 Calculation', () => {
    it('should deterministically compute 64-character hex hash', () => {
      const buf1 = Buffer.from('DocuNexa-Deterministic-Hash-Test');
      const hash1 = computeSha256(buf1);
      const hash2 = computeSha256(buf1);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different payloads', () => {
      const hashA = computeSha256(Buffer.from('DocA'));
      const hashB = computeSha256(Buffer.from('DocB'));
      expect(hashA).not.toBe(hashB);
    });
  });
});
