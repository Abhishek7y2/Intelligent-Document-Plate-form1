import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ClassificationService } from '../services/classification.service.js';
import { DocumentNotEligibleError, OcrNotFoundError } from '../services/intake.service.js';

export async function classifyDocumentHandler(
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

    const result = await ClassificationService.classifyDocument(documentId, tenantId);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Document classification completed successfully.',
      data: result,
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

    next(err);
  }
}

export async function getClassificationHandler(
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

    const result = await ClassificationService.getClassification(documentId, tenantId);

    if (!result) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/CLASSIFICATION_NOT_FOUND',
        title: `Classification result for document '${documentId}' not found.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Document classification retrieved successfully.',
      data: result,
    });
  } catch (err: any) {
    next(err);
  }
}
