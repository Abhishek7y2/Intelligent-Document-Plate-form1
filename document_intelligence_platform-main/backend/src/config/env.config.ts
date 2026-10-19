import dotenv from 'dotenv';
import path from 'path';

// Load .env file if available
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function requireSecret(name: string, minLength: number = 32): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`FATAL: Required environment secret '${name}' is missing. Application cannot start without configured secret.`);
  }
  if (value.trim().length < minLength) {
    throw new Error(`FATAL: Environment secret '${name}' must be at least ${minLength} characters long for cryptographic security.`);
  }
  return value.trim();
}

export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  postgres: {
    host: string;
    port: number;
    user: string;
    pass: string;
    database: string;
    ssl: boolean;
    maxPool: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer?: string;
    audience?: string;
  };
  audit: {
    hmacSecret: string;
  };
  rateLimit: {
    authWindowMs: number;
    authMaxAttempts: number;
    storeType: 'memory' | 'postgres';
  };
  trustProxy: boolean | string | number;
  corsAllowedOrigins: string[];
  storage: {
    driver: string;
    s3: {
      endpoint?: string;
      region: string;
      bucket: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      forcePathStyle: boolean;
    };
    local: {
      baseDir: string;
    };
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  gemini: {
    apiKey: string;
    ocrEngine: string;
  };
  ocr: {
    provider: 'tesseract' | 'gemini';
    externalProviderAllowed: boolean;
  };
  redis: {
    url?: string;
    host: string;
    port: number;
    password?: string;
    queuePrefix: string;
  };
  mfa: {
    encKey: string;
  };
  mongo: {
    url: string;
    database: string;
    derivedStoreMode: 'postgres' | 'dual' | 'mongo';
  };
  imap: {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

export const config: AppConfig = {
  env: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '8080', 10),
  apiPrefix: process.env['API_PREFIX'] || '/api/v1',
  postgres: {
    host: process.env['DB_HOST'] || process.env['POSTGRES_HOST'] || '127.0.0.1',
    port: parseInt(process.env['DB_PORT'] || process.env['POSTGRES_PORT'] || '5433', 10),
    user: process.env['DB_USERNAME'] || process.env['POSTGRES_USER'] || 'postgres',
    pass: process.env['DB_PASSWORD'] || process.env['POSTGRES_PASSWORD'] || '',
    database: process.env['DB_DATABASE'] || process.env['POSTGRES_DB'] || 'docunexa',
    ssl: (process.env['DB_SSL'] || process.env['POSTGRES_SSL']) === 'true',
    maxPool: parseInt(process.env['DB_MAX_POOL'] || process.env['POSTGRES_MAX_POOL'] || '20', 10),
  },
  jwt: {
    get secret(): string {
      return requireSecret('JWT_SECRET', 32);
    },
    expiresIn: process.env['JWT_EXPIRES_IN'] || '8h',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
    issuer: process.env['JWT_ISSUER'] || undefined,
    audience: process.env['JWT_AUDIENCE'] || undefined,
  },
  audit: {
    get hmacSecret(): string {
      return requireSecret('AUDIT_HMAC_SECRET', 32);
    },
  },
  rateLimit: {
    authWindowMs: parseInt(process.env['AUTH_RATE_LIMIT_WINDOW_MS'] || '60000', 10),
    authMaxAttempts: parseInt(process.env['AUTH_RATE_LIMIT_MAX_ATTEMPTS'] || '5', 10),
    storeType: (process.env['RATE_LIMIT_STORE'] || 'postgres') as 'memory' | 'postgres',
  },
  trustProxy: (() => {
    const tp = process.env['TRUST_PROXY'];
    if (!tp || tp === 'false') return false;
    if (tp === 'true') return true;
    const num = Number(tp);
    return isNaN(num) ? tp : num;
  })(),
  corsAllowedOrigins: (process.env['CORS_ALLOWED_ORIGINS'] || 'http://localhost:4200').split(','),
  storage: {
    driver: process.env['STORAGE_DRIVER'] || (process.env['NODE_ENV'] === 'test' ? 'memory' : 's3'),
    s3: {
      endpoint: process.env['S3_ENDPOINT'] || undefined,
      region: process.env['S3_REGION'] || process.env['AWS_REGION'] || 'us-east-1',
      bucket: process.env['S3_BUCKET'] || 'docunexa-documents',
      accessKeyId: process.env['S3_ACCESS_KEY_ID'] || process.env['AWS_ACCESS_KEY_ID'] || undefined,
      secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'] || process.env['AWS_SECRET_ACCESS_KEY'] || undefined,
      forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true' || Boolean(process.env['S3_ENDPOINT']),
    },
    local: {
      baseDir: process.env['STORAGE_LOCAL_DIR'] || 'data/storage',
    },
  },
  smtp: {
    host: process.env['SMTP_HOST'] || '127.0.0.1',
    port: parseInt(process.env['SMTP_PORT'] || '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    user: process.env['SMTP_USER'] || '',
    pass: process.env['SMTP_PASS'] || '',
    from: process.env['SMTP_FROM'] || 'DocNexa Security <no-reply@docnexa.io>',
  },
  gemini: {
    apiKey: process.env['GEMINI_API_KEY'] || '',
    ocrEngine: process.env['OCR_ENGINE'] || (process.env['GEMINI_API_KEY'] ? 'gemini' : 'tesseract'),
  },
  ocr: {
    provider: ((process.env['OCR_PROVIDER'] || 'tesseract').toLowerCase() as 'tesseract' | 'gemini'),
    externalProviderAllowed: process.env['OCR_EXTERNAL_PROVIDER_ALLOWED'] === 'true',
  },
  redis: {
    url: process.env['REDIS_URL'],
    host: process.env['REDIS_HOST'] || '127.0.0.1',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    queuePrefix: process.env['QUEUE_PREFIX'] || 'docunexa',
  },
  mfa: {
    get encKey(): string {
      const val = process.env['MFA_ENC_KEY'];
      if (!val || val.trim().length !== 64) {
        if (config.env === 'production') {
          return requireSecret('MFA_ENC_KEY', 64);
        }
        return '9f8e7d6c5b4a3928170f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69';
      }
      return val.trim();
    },
  },
  mongo: {
    url: process.env['MONGO_URL'] || process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017',
    database: process.env['MONGO_DB'] || 'docunexa',
    derivedStoreMode: (process.env['DERIVED_STORE_MODE'] || 'dual') as 'postgres' | 'dual' | 'mongo',
  },
  imap: {
    enabled: process.env['EMAIL_INTAKE_ENABLED'] === 'true',
    host: process.env['IMAP_HOST'] || '',
    port: parseInt(process.env['IMAP_PORT'] || '993', 10),
    user: process.env['IMAP_USER'] || '',
    pass: process.env['IMAP_PASS'] || '',
  },
};

export function validateEnvironment(): void {
  const isProd = (process.env['NODE_ENV'] || config.env) === 'production';

  // Validate presence and length of required cryptographic secrets
  requireSecret('JWT_SECRET', 32);
  requireSecret('AUDIT_HMAC_SECRET', 32);
  if (isProd) {
    requireSecret('MFA_ENC_KEY', 64);
  }

  // Validate OCR Provider (Sprint 8 Part 0.2)
  const validOcrProviders = ['tesseract', 'gemini'];
  const configuredOcrProvider = process.env['OCR_PROVIDER'] || config.ocr.provider;
  if (!validOcrProviders.includes(configuredOcrProvider)) {
    throw new Error(`Invalid OCR_PROVIDER: '${configuredOcrProvider}'. Expected one of: ${validOcrProviders.join(', ')}.`);
  }
  const isExternalAllowed = process.env['OCR_EXTERNAL_PROVIDER_ALLOWED'] === 'true' || config.ocr.externalProviderAllowed;
  if (configuredOcrProvider === 'gemini' && !isExternalAllowed) {
    throw new Error(
      'OCR configuration error: External OCR provider "gemini" is disallowed without explicit authorization. ' +
      'Set OCR_EXTERNAL_PROVIDER_ALLOWED=true to permit external processing. ' +
      'NOTICE: Enabling this transmits tenant document payload data outside the local platform environment.'
    );
  }

  // Validate MongoDB settings when in production with mongo or dual mode
  const derivedStoreMode = process.env['DERIVED_STORE_MODE'] || config.mongo.derivedStoreMode;
  if (isProd && derivedStoreMode !== 'postgres') {
    if (!process.env['MONGO_URL'] && !process.env['MONGODB_URI']) {
      throw new Error('Production configuration error: MONGO_URL (or MONGODB_URI) is required when derived store mode is dual or mongo.');
    }
  }

  // Validate IMAP email intake settings when enabled
  const imapEnabled = process.env['EMAIL_INTAKE_ENABLED'] === 'true' || config.imap.enabled;
  if (imapEnabled) {
    const imapHost = process.env['IMAP_HOST'] || config.imap.host;
    const imapUser = process.env['IMAP_USER'] || config.imap.user;
    const imapPass = process.env['IMAP_PASS'] || config.imap.pass;
    if (!imapHost || !imapUser || !imapPass) {
      throw new Error('Email intake configuration error: IMAP_HOST, IMAP_USER, and IMAP_PASS are required when EMAIL_INTAKE_ENABLED=true.');
    }
  }

  if (isProd) {
    const storageDriver = process.env['STORAGE_DRIVER'] || config.storage.driver;
    if (storageDriver === 'memory') {
      throw new Error(
        'Production configuration error: In-memory storage is forbidden in production. Configure STORAGE_DRIVER=s3 with valid S3 or MinIO credentials.'
      );
    }
    const scannerType = process.env['SCANNER_TYPE'];
    if (scannerType === 'mock') {
      throw new Error(
        'Production configuration error: Mock malware scanner is forbidden in production environments. Configure real ClamAV daemon connection.'
      );
    }
    const rateLimitStore = process.env['RATE_LIMIT_STORE'] || config.rateLimit.storeType;
    if (rateLimitStore === 'memory' && process.env['RATE_LIMIT_ALLOW_MEMORY_IN_PROD'] !== 'true') {
      throw new Error(
        'Production configuration error: In-memory rate limiting is not permitted across multi-instance deployments. Configure RATE_LIMIT_STORE=postgres or set RATE_LIMIT_ALLOW_MEMORY_IN_PROD=true to override.'
      );
    }

    // Part B.3 Checks:
    // Check MongoDB auth in production when derived store needs Mongo
    if (derivedStoreMode !== 'postgres') {
      const mongoUri = process.env['MONGO_URL'] || process.env['MONGODB_URI'] || config.mongo.url || '';
      if (!mongoUri.includes('@') && process.env['MONGO_ALLOW_NO_AUTH_IN_PROD'] !== 'true') {
        throw new Error(
          'Production configuration error: MONGO_URL requires authenticated credentials (e.g. mongodb://user:pass@host) when derived store mode is dual or mongo.'
        );
      }
    }

    // Check Redis password in production
    const redisPassword = process.env['REDIS_PASSWORD'] || config.redis.password;
    if (!redisPassword && process.env['REDIS_ALLOW_NO_PASSWORD_IN_PROD'] !== 'true') {
      throw new Error(
        'Production configuration error: REDIS_PASSWORD is required in production environments to prevent unauthenticated cache/queue access.'
      );
    }

    // Check CORS allowlist in production
    const corsList = (process.env['CORS_ALLOWLIST'] || process.env['CORS_ALLOWED_ORIGINS'] || '').trim();
    if (!corsList || corsList === '*') {
      throw new Error(
        'Production configuration error: CORS allowlist cannot be empty or wildcard in production. Configure CORS_ALLOWLIST or CORS_ALLOWED_ORIGINS with explicit origins.'
      );
    }
  }
}

