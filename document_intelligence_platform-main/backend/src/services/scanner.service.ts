import net from 'net';
import { MalwareScanResult } from '../models/intake.models.js';
import { Logger } from '../utils/logger.js';

export const EICAR_TEST_STRING = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export interface MalwareScanner {
  scanBuffer(buffer: Buffer, filename: string): Promise<MalwareScanResult>;
}

export class ScannerUnavailableError extends Error {
  statusCode: number;
  code: string;

  constructor(message = 'Malware scanner service is unavailable. Intake operates under fail-closed security policy.') {
    super(message);
    this.name = 'ScannerUnavailableError';
    this.statusCode = 503;
    this.code = 'SCANNER_UNAVAILABLE';
  }
}

/**
 * ClamAV daemon integration via TCP INSTREAM protocol
 */
export class ClamAvScanner implements MalwareScanner {
  private host: string;
  private port: number;
  private timeoutMs: number;

  constructor(host = process.env['CLAMAV_HOST'] || 'localhost', port = parseInt(process.env['CLAMAV_PORT'] || '3310', 10), timeoutMs = 10000) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
  }

  async scanBuffer(buffer: Buffer, filename: string): Promise<MalwareScanResult> {
    // 1. Check for standard EICAR test signature before remote socket
    if (buffer.toString('utf-8').includes(EICAR_TEST_STRING)) {
      Logger.warn({
        message: `Malware detected during upload: EICAR-Test-Signature in ${filename}`,
        context: 'ClamAvScanner',
        data: { filename, threat: 'EICAR-Test-Signature' },
      });
      return {
        clean: false,
        threatName: 'Win.Test.EICAR_HDB-1',
        scanner: 'ClamAV-Local-PreFilter',
        scannedAt: new Date(),
      };
    }

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let response = '';

      socket.setTimeout(this.timeoutMs);

      socket.connect(this.port, this.host, () => {
        // Send INSTREAM command
        socket.write('zINSTREAM\0');

        // Send buffer chunks with length prefix
        const chunkSize = 2048;
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.subarray(i, i + chunkSize);
          const sizeBuf = Buffer.alloc(4);
          sizeBuf.writeUInt32BE(chunk.length, 0);
          socket.write(sizeBuf);
          socket.write(chunk);
        }

        // Send 0-length terminator chunk
        const zeroBuf = Buffer.alloc(4);
        zeroBuf.writeUInt32BE(0, 0);
        socket.write(zeroBuf);
      });

      socket.on('data', (data) => {
        response += data.toString('utf-8');
      });

      socket.on('end', () => {
        socket.destroy();
        const trimmed = response.trim();
        if (trimmed.endsWith('OK')) {
          resolve({
            clean: true,
            scanner: 'ClamAV-Daemon',
            scannedAt: new Date(),
          });
        } else if (trimmed.includes('FOUND')) {
          const match = trimmed.match(/stream:\s+(.+)\s+FOUND/);
          const threatName = match ? match[1] : 'Unknown-Malware';
          resolve({
            clean: false,
            threatName,
            scanner: 'ClamAV-Daemon',
            scannedAt: new Date(),
          });
        } else {
          reject(new ScannerUnavailableError(`Unexpected ClamAV daemon response: ${trimmed}`));
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new ScannerUnavailableError(`ClamAV scanner connection timed out after ${this.timeoutMs}ms.`));
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(new ScannerUnavailableError(`Malware scanner daemon connection failed: Service temporarily unreachable.`));
      });
    });
  }
}

/**
 * Mock Malware Scanner for synthetic unit and integration tests
 */
export class MockMalwareScanner implements MalwareScanner {
  private mode: 'always_clean' | 'always_infected' | 'fail_offline' | 'heuristic';
  private threatToReport: string;

  constructor(mode: 'always_clean' | 'always_infected' | 'fail_offline' | 'heuristic' = 'heuristic', threatToReport = 'Trojan.Generic.DocIntel') {
    this.mode = mode;
    this.threatToReport = threatToReport;
  }

  setMode(mode: 'always_clean' | 'always_infected' | 'fail_offline' | 'heuristic'): void {
    this.mode = mode;
  }

  async scanBuffer(buffer: Buffer, filename: string): Promise<MalwareScanResult> {
    if (this.mode === 'fail_offline') {
      throw new ScannerUnavailableError('ClamAV daemon offline (Simulated in MockMalwareScanner).');
    }

    if (this.mode === 'always_infected') {
      return {
        clean: false,
        threatName: this.threatToReport,
        scanner: 'MockScanner',
        scannedAt: new Date(),
      };
    }

    if (this.mode === 'always_clean') {
      return {
        clean: true,
        scanner: 'MockScanner',
        scannedAt: new Date(),
      };
    }

    // Heuristic mode: Check for EICAR signature or test indicator in filename
    const isEicar = buffer.toString('utf-8').includes(EICAR_TEST_STRING) || filename.includes('eicar') || filename.includes('infected');
    if (isEicar) {
      return {
        clean: false,
        threatName: 'EICAR-Test-Signature',
        scanner: 'MockScanner-Heuristic',
        scannedAt: new Date(),
      };
    }

    return {
      clean: true,
      scanner: 'MockScanner-Heuristic',
      scannedAt: new Date(),
    };
  }
}

/**
 * Factory for creating and managing malware scanner instances
 */
export class ScannerFactory {
  private static instance: MalwareScanner | null = null;

  static getScanner(): MalwareScanner {
    if (this.instance) return this.instance;

    const configured = process.env['SCANNER_TYPE']?.toLowerCase();
    const env = process.env['NODE_ENV'] || 'development';

    if (configured === 'mock' || (env === 'development' && configured !== 'clamav')) {
      if (env === 'production') {
        throw new Error('Production security violation: MockMalwareScanner is strictly forbidden in production.');
      }
      this.instance = new MockMalwareScanner('heuristic');
      return this.instance;
    }

    if (env === 'test' && !configured) {
      this.instance = new MockMalwareScanner('heuristic');
      return this.instance;
    }

    this.instance = new ClamAvScanner();
    return this.instance;
  }

  static setScanner(scanner: MalwareScanner | null): void {
    this.instance = scanner;
  }

  static reset(): void {
    this.instance = null;
  }
}
