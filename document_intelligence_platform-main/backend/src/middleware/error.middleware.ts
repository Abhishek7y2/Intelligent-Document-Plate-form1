import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.config.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = err.statusCode || 500;
  const correlationId = (req.headers['x-correlation-id'] as string) || 'N/A';

  // Map Multer file size and upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      err.message = 'Uploaded file exceeds the maximum allowed limit of 50 MB.';
    } else {
      statusCode = 400;
      err.code = 'MULTIPART_UPLOAD_ERROR';
    }
  }

  let safeTitle = err.message || 'An unexpected internal error occurred.';
  if (err.code === 'DATABASE_UNAVAILABLE') {
    safeTitle = 'Database service is currently unavailable. Operation aborted to preserve data integrity.';
  } else if (statusCode >= 500 && config.env === 'production') {
    safeTitle = 'An internal server error occurred. Please contact the platform administrator.';
  }

  const problemDetails = {
    type: `https://api.docunexa.enterprise/errors/${err.code || 'INTERNAL_ERROR'}`,
    title: safeTitle,
    status: statusCode,
    detail: config.env === 'development' ? err.stack : undefined,
    instance: req.originalUrl,
    correlationId,
    timestamp: new Date().toISOString(),
  };

  if (statusCode >= 500) {
    console.error(`[ERROR ${statusCode}] CorrelationId: ${correlationId} - ${err.stack || err.message}`);
  }

  res.status(statusCode).json(problemDetails);
}
