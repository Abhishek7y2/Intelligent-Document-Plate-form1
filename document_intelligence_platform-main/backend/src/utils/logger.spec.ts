import { redactSensitiveData } from './logger.js';

describe('Logger Sensitive Data Redaction Utility', () => {
  it('should redact sensitive properties like passwords, tokens, and authorization headers', () => {
    const inputPayload = {
      user: 'analyst@docunexa.io',
      password: 'SuperSecretPassword123!',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      metadata: {
        authorization: 'Bearer secret_token',
        fileName: 'Invoice_9941.pdf',
      },
    };

    const redacted = redactSensitiveData(inputPayload);

    expect(redacted.user).toBe('analyst@docunexa.io');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.metadata.authorization).toBe('[REDACTED]');
    expect(redacted.metadata.fileName).toBe('Invoice_9941.pdf');
  });

  it('should recursively redact sensitive data inside arrays of objects', () => {
    const arrayInput = [
      { id: '1', apiKey: 'SECRET_API_KEY_123' },
      { id: '2', mfaCode: '984120' },
    ];

    const redacted = redactSensitiveData(arrayInput);

    expect(redacted[0].id).toBe('1');
    expect(redacted[0].apiKey).toBe('[REDACTED]');
    expect(redacted[1].id).toBe('2');
    expect(redacted[1].mfaCode).toBe('[REDACTED]');
  });
});
