export interface LogPayload {
  message: string;
  correlationId?: string;
  context?: string;
  data?: Record<string, any>;
  error?: Error;
}

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'secret', 'bearer', 'mfacode', 'ssn', 'creditcard', 'cookie', 'api_key', 'apikey'];

// Redact sensitive payload properties recursively (objects & arrays) before logging
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return data;
}

import { getCorrelationId } from '../middleware/correlation.middleware.js';

export class Logger {
  static info(payload: LogPayload): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      correlationId: payload.correlationId || getCorrelationId(),
      context: payload.context || 'App',
      message: payload.message,
      data: payload.data ? redactSensitiveData(payload.data) : undefined,
    };
    console.log(JSON.stringify(logEntry));
  }

  static warn(payload: LogPayload): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      correlationId: payload.correlationId || getCorrelationId(),
      context: payload.context || 'App',
      message: payload.message,
      data: payload.data ? redactSensitiveData(payload.data) : undefined,
    };
    console.warn(JSON.stringify(logEntry));
  }

  static error(payload: LogPayload): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      correlationId: payload.correlationId || getCorrelationId(),
      context: payload.context || 'App',
      message: payload.message,
      data: payload.data ? redactSensitiveData(payload.data) : undefined,
      stack: payload.error ? payload.error.stack : undefined,
    };
    console.error(JSON.stringify(logEntry));
  }
}
