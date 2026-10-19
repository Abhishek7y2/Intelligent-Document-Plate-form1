import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Logger } from '../utils/logger.js';

export interface ObjectStorageService {
  putObject(key: string, buffer: Buffer, metadata?: Record<string, string>): Promise<{ storagePath: string; size: number }>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<boolean>;
  hasObject(key: string): Promise<boolean>;
  listKeys(prefix?: string): Promise<string[]> | string[];
}

export interface S3StorageConfig {
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/**
 * Enterprise S3-compatible object storage adapter supporting AWS S3 and MinIO
 */
export class S3CompatibleStorageService implements ObjectStorageService {
  private client: S3Client;
  private bucket: string;
  private endpoint?: string;

  constructor(options?: Partial<S3StorageConfig>) {
    this.bucket = options?.bucket !== undefined ? options.bucket : (process.env['S3_BUCKET'] || 'docunexa-documents');
    this.endpoint = options?.endpoint || process.env['S3_ENDPOINT'] || undefined;
    const region = options?.region || process.env['S3_REGION'] || process.env['AWS_REGION'] || 'us-east-1';
    const accessKeyId = options?.accessKeyId || process.env['S3_ACCESS_KEY_ID'] || process.env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = options?.secretAccessKey || process.env['S3_SECRET_ACCESS_KEY'] || process.env['AWS_SECRET_ACCESS_KEY'];
    
    // MinIO requires path-style addressing
    const forcePathStyle = options?.forcePathStyle !== undefined
      ? options.forcePathStyle
      : (process.env['S3_FORCE_PATH_STYLE'] === 'true' || Boolean(this.endpoint));

    if (!this.bucket || this.bucket.trim().length === 0) {
      throw new Error('S3 storage initialization error: S3_BUCKET name is required.');
    }

    const s3Config: S3ClientConfig = {
      region,
      forcePathStyle,
    };

    if (this.endpoint) {
      s3Config.endpoint = this.endpoint;
    }

    if (accessKeyId && secretAccessKey) {
      s3Config.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new S3Client(s3Config);
  }

  getBucketName(): string {
    return this.bucket;
  }

  getEndpoint(): string | undefined {
    return this.endpoint;
  }

  private normalizeKey(key: string): string {
    // Strip URI schemes and bucket names if caller passes full URI (e.g. s3://bucket/key or memory://key)
    let clean = key.replace(/^s3:\/\/[^/]+\//, '').replace(/^memory:\/\//, '');
    // Prevent path traversal
    clean = clean.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    if (!clean) {
      throw new Error('Invalid storage key: key cannot be empty or root.');
    }
    return clean;
  }

  async putObject(
    key: string,
    buffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<{ storagePath: string; size: number }> {
    const cleanKey = this.normalizeKey(key);
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: buffer,
        ContentLength: buffer.length,
        Metadata: metadata,
      });

      await this.client.send(command);

      return {
        storagePath: `s3://${this.bucket}/${cleanKey}`,
        size: buffer.length,
      };
    } catch (err: any) {
      Logger.error({
        message: `S3 PutObject error for key ${cleanKey}: ${err.message}`,
        context: 'S3CompatibleStorageService',
        error: err,
      });
      throw err;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const cleanKey = this.normalizeKey(key);
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error(`Object not found in storage: ${key}`);
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        throw new Error(`Object not found in storage: ${key}`);
      }
      Logger.error({
        message: `S3 GetObject error for key ${cleanKey}: ${err.message}`,
        context: 'S3CompatibleStorageService',
        error: err,
      });
      throw err;
    }
  }

  async deleteObject(key: string): Promise<boolean> {
    const cleanKey = this.normalizeKey(key);
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      Logger.error({
        message: `S3 DeleteObject error for key ${cleanKey}: ${err.message}`,
        context: 'S3CompatibleStorageService',
        error: err,
      });
      throw err;
    }
  }

  async hasObject(key: string): Promise<boolean> {
    const cleanKey = this.normalizeKey(key);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      Logger.error({
        message: `S3 HeadObject error for key ${cleanKey}: ${err.message}`,
        context: 'S3CompatibleStorageService',
        error: err,
      });
      throw err;
    }
  }

  async listKeys(prefix = ''): Promise<string[]> {
    const cleanPrefix = prefix ? this.normalizeKey(prefix) : '';
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: cleanPrefix,
      });

      const response = await this.client.send(command);
      return (response.Contents || []).map((item) => item.Key || '').filter(Boolean);
    } catch (err: any) {
      Logger.error({
        message: `S3 ListObjects error for prefix ${cleanPrefix}: ${err.message}`,
        context: 'S3CompatibleStorageService',
        error: err,
      });
      throw err;
    }
  }
}

/**
 * Local filesystem object storage adapter
 */
export class LocalStorageService implements ObjectStorageService {
  private baseDir: string;

  constructor(baseDir = path.resolve(process.cwd(), 'data/storage')) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveKey(key: string): string {
    const clean = key.replace(/^s3:\/\/[^/]+\//, '').replace(/^memory:\/\//, '');
    const safeKey = clean.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    return path.resolve(this.baseDir, safeKey);
  }

  async putObject(key: string, buffer: Buffer): Promise<{ storagePath: string; size: number }> {
    const fullPath = this.resolveKey(key);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, buffer);
    return {
      storagePath: fullPath,
      size: buffer.length,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const fullPath = this.resolveKey(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Object not found in storage: ${key}`);
    }
    return fs.promises.readFile(fullPath);
  }

  async deleteObject(key: string): Promise<boolean> {
    const fullPath = this.resolveKey(key);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }
    return false;
  }

  async hasObject(key: string): Promise<boolean> {
    const fullPath = this.resolveKey(key);
    return fs.existsSync(fullPath);
  }

  listKeys(prefix = ''): string[] {
    const results: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const rel = path.relative(this.baseDir, full).replace(/\\/g, '/');
          if (rel.startsWith(prefix)) {
            results.push(rel);
          }
        }
      }
    };
    walk(this.baseDir);
    return results;
  }
}

/**
 * In-memory storage adapter for zero-side-effect test suites
 */
export class MemoryStorageService implements ObjectStorageService {
  private store = new Map<string, Buffer>();

  private cleanKey(key: string): string {
    return key.replace(/^memory:\/\//, '').replace(/^s3:\/\/[^/]+\//, '').replace(/^[/\\]+/, '');
  }

  async putObject(key: string, buffer: Buffer): Promise<{ storagePath: string; size: number }> {
    const clean = this.cleanKey(key);
    this.store.set(clean, Buffer.from(buffer));
    return {
      storagePath: `memory://${clean}`,
      size: buffer.length,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const clean = this.cleanKey(key);
    const buf = this.store.get(clean);
    if (!buf) {
      throw new Error(`Object not found in memory store: ${key}`);
    }
    return Buffer.from(buf);
  }

  async deleteObject(key: string): Promise<boolean> {
    const clean = this.cleanKey(key);
    return this.store.delete(clean);
  }

  async hasObject(key: string): Promise<boolean> {
    const clean = this.cleanKey(key);
    return this.store.has(clean);
  }

  listKeys(prefix = ''): string[] {
    const cleanPrefix = prefix ? this.cleanKey(prefix) : '';
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      if (!cleanPrefix || key.startsWith(cleanPrefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  clear(): void {
    this.store.clear();
  }
}

export type StorageDriverType = 's3' | 'local' | 'memory';

/**
 * Central storage factory enforcing production non-memory policies and runtime driver configuration
 */
export class StorageFactory {
  private static instance: ObjectStorageService | null = null;

  static getDriverType(): StorageDriverType {
    const configuredDriver = process.env['STORAGE_DRIVER']?.toLowerCase();
    const env = process.env['NODE_ENV'] || 'development';

    if (configuredDriver) {
      if (configuredDriver !== 's3' && configuredDriver !== 'local' && configuredDriver !== 'memory') {
        throw new Error(
          `Unsupported storage driver '${configuredDriver}'. Allowed drivers are 's3', 'local', and 'memory'.`
        );
      }
      if (configuredDriver === 'memory' && env === 'production') {
        throw new Error(
          'Production safety violation: In-memory storage is forbidden in production environments. Configure STORAGE_DRIVER=s3 with valid S3/MinIO bucket credentials.'
        );
      }
      return configuredDriver as StorageDriverType;
    }

    // Default outside tests is 's3'. In test environment, defaults to 'memory'. In development, defaults to 'local'.
    if (env === 'test') {
      return 'memory';
    }
    if (env === 'development') {
      return 'local';
    }
    return 's3';
  }

  static createStorage(driver?: StorageDriverType): ObjectStorageService {
    const selected = driver || this.getDriverType();
    switch (selected) {
      case 's3':
        return new S3CompatibleStorageService();
      case 'local':
        return new LocalStorageService();
      case 'memory':
        return new MemoryStorageService();
      default:
        throw new Error(`Unsupported storage driver: ${selected}`);
    }
  }

  static getStorage(): ObjectStorageService {
    if (!this.instance) {
      this.instance = this.createStorage();
    }
    return this.instance;
  }

  static setStorage(storage: ObjectStorageService | null): void {
    this.instance = storage;
  }

  static reset(): void {
    this.instance = null;
  }
}
