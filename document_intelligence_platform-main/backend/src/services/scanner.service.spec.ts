import {
  MockMalwareScanner,
  ClamAvScanner,
  ScannerUnavailableError,
  EICAR_TEST_STRING,
} from './scanner.service.js';

describe('Sprint 4: Malware Scanner Adapter & Fail-Closed Boundary', () => {
  const cleanBuffer = Buffer.from('%PDF-1.7\nClean enterprise document body');
  const eicarBuffer = Buffer.from(`%PDF-1.7\n${EICAR_TEST_STRING}\nTrailing data`);

  describe('MockMalwareScanner', () => {
    it('should report clean in heuristic mode for regular clean buffer', async () => {
      const scanner = new MockMalwareScanner('heuristic');
      const result = await scanner.scanBuffer(cleanBuffer, 'invoice.pdf');

      expect(result.clean).toBe(true);
      expect(result.threatName).toBeUndefined();
      expect(result.scanner).toBe('MockScanner-Heuristic');
    });

    it('should detect EICAR string and flag as infected in heuristic mode', async () => {
      const scanner = new MockMalwareScanner('heuristic');
      const result = await scanner.scanBuffer(eicarBuffer, 'suspicious.pdf');

      expect(result.clean).toBe(false);
      expect(result.threatName).toBe('EICAR-Test-Signature');
    });

    it('should flag as infected when filename contains malware keywords in heuristic mode', async () => {
      const scanner = new MockMalwareScanner('heuristic');
      const result = await scanner.scanBuffer(cleanBuffer, 'payload_infected.pdf');

      expect(result.clean).toBe(false);
      expect(result.threatName).toBe('EICAR-Test-Signature');
    });

    it('should report clean when mode is always_clean', async () => {
      const scanner = new MockMalwareScanner('always_clean');
      const result = await scanner.scanBuffer(eicarBuffer, 'test.pdf');

      expect(result.clean).toBe(true);
    });

    it('should report infected with specified threat when mode is always_infected', async () => {
      const scanner = new MockMalwareScanner('always_infected', 'Worm.Win32.DocuExploit');
      const result = await scanner.scanBuffer(cleanBuffer, 'normal.pdf');

      expect(result.clean).toBe(false);
      expect(result.threatName).toBe('Worm.Win32.DocuExploit');
    });

    it('should throw ScannerUnavailableError when mode is fail_offline (fail-closed principle)', async () => {
      const scanner = new MockMalwareScanner('fail_offline');

      await expect(scanner.scanBuffer(cleanBuffer, 'doc.pdf')).rejects.toThrow(
        ScannerUnavailableError
      );
    });
  });

  describe('ClamAvScanner (Fail-Closed Security Boundary)', () => {
    it('should detect EICAR signature in pre-filter without socket connection', async () => {
      // Points to unreachable port to prove pre-filter runs locally before TCP connect
      const scanner = new ClamAvScanner('127.0.0.1', 65530, 2000);
      const result = await scanner.scanBuffer(eicarBuffer, 'quarantine_candidate.pdf');

      expect(result.clean).toBe(false);
      expect(result.threatName).toBe('Win.Test.EICAR_HDB-1');
      expect(result.scanner).toBe('ClamAV-Local-PreFilter');
    });

    it('should throw ScannerUnavailableError when daemon is offline rather than claiming clean', async () => {
      // Unreachable port to simulate offline daemon
      const scanner = new ClamAvScanner('127.0.0.1', 65530, 500);

      await expect(scanner.scanBuffer(cleanBuffer, 'doc.pdf')).rejects.toThrow(
        ScannerUnavailableError
      );
    });

    it('should produce RFC 7807 compatible error properties on ScannerUnavailableError', () => {
      const err = new ScannerUnavailableError('Scanner connection timed out');
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('SCANNER_UNAVAILABLE');
      expect(err.name).toBe('ScannerUnavailableError');
    });
  });
});
