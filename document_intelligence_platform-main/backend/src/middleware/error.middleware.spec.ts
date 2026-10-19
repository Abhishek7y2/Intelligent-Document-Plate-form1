import { Request, Response } from 'express';
import { errorHandler, AppError } from './error.middleware.js';

describe('RFC-7807 Problem Details Error Middleware', () => {
  it('should format errors using RFC-7807 problem details structure', () => {
    const mockReq = {
      originalUrl: '/api/v1/documents/DOC-99',
      headers: { 'x-correlation-id': 'CORR-TEST-123' },
    } as unknown as Request;

    let jsonResult: any = null;
    let statusResult: number = 0;

    const mockRes = {
      status: (code: number) => {
        statusResult = code;
        return {
          json: (data: any) => {
            jsonResult = data;
          },
        };
      },
    } as unknown as Response;

    const mockNext = jest.fn();

    const err: AppError = new Error('Resource not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(statusResult).toBe(404);
    expect(jsonResult.status).toBe(404);
    expect(jsonResult.title).toBe('Resource not found');
    expect(jsonResult.correlationId).toBe('CORR-TEST-123');
    expect(jsonResult.type).toContain('NOT_FOUND');
  });

  it('should sanitize DATABASE_UNAVAILABLE errors (HTTP 503) without leaking internal connection details', () => {
    const mockReq = {
      originalUrl: '/api/v1/document-types',
      headers: { 'x-correlation-id': 'CORR-DB-FAIL' },
    } as unknown as Request;

    let jsonResult: any = null;
    let statusResult: number = 0;

    const mockRes = {
      status: (code: number) => {
        statusResult = code;
        return {
          json: (data: any) => {
            jsonResult = data;
          },
        };
      },
    } as unknown as Response;

    const mockNext = jest.fn();

    const dbErr: AppError = new Error('password authentication failed for user "docunexa_user"');
    dbErr.statusCode = 503;
    dbErr.code = 'DATABASE_UNAVAILABLE';

    errorHandler(dbErr, mockReq, mockRes, mockNext);

    expect(statusResult).toBe(503);
    expect(jsonResult.status).toBe(503);
    expect(jsonResult.title).toContain('Database service is currently unavailable');
    expect(jsonResult.title).not.toContain('password');
    expect(jsonResult.title).not.toContain('docunexa_user');
    expect(jsonResult.type).toContain('DATABASE_UNAVAILABLE');
  });
});
