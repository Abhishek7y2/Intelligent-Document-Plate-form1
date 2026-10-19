import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { OcrService, DocumentNotEligibleError, OcrNotFoundError } from '../services/ocr.service.js';
import { OcrProcessingError } from '../services/tesseract-ocr.adapter.js';

export async function processOcrHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/INVALID_REQUEST',
        title: 'Missing mandatory document identifier.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const { engineType, maxPages, timeoutMs } = req.body || {};

    const ocrResult = await OcrService.processDocument(documentId, tenantId, {
      engineType,
      maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
      timeoutMs: timeoutMs ? parseInt(timeoutMs, 10) : undefined,
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'OCR extraction and geometry normalization completed successfully.',
      data: ocrResult,
    });
  } catch (err: any) {
    if (err instanceof DocumentNotEligibleError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: err.message,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof OcrProcessingError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        instance: req.originalUrl,
      });
      return;
    }

    next(err);
  }
}

export async function getOcrResultHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const result = await OcrService.getOcrResult(documentId, tenantId);
    if (!result) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/OCR_NOT_FOUND',
        title: `OCR results not found for document '${documentId}'.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(200).json({
      status: 'SUCCESS',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPageGeometryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const documentId = req.params['id'];
    const pageNumStr = req.params['pageNumber'];
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const pageNumber = parseInt(pageNumStr, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/INVALID_PAGE_NUMBER',
        title: 'Page number must be a positive 1-indexed integer.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const pageGeometry = await OcrService.getPageGeometry(documentId, pageNumber, tenantId);
    if (!pageGeometry) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/PAGE_GEOMETRY_NOT_FOUND',
        title: `Geometry for page ${pageNumber} of document '${documentId}' not found.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(200).json({
      status: 'SUCCESS',
      data: pageGeometry,
    });
  } catch (err) {
    next(err);
  }
}
