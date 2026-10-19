import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CompareService } from '../services/compare.service.js';

export async function compareDocumentsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId || 'DEFAULT';
    const actorId = req.user?.userId || 'SYSTEM';

    let docId1: string;
    let docId2: string;

    if (req.method === 'POST') {
      docId1 = req.body.documentId1 || req.body.docId1;
      docId2 = req.body.documentId2 || req.body.docId2;
    } else {
      docId1 = (req.query['doc1'] as string) || (req.query['documentId1'] as string);
      docId2 = (req.query['doc2'] as string) || (req.query['documentId2'] as string);
    }

    if (!docId1 || !docId2) {
      res.status(400).json({
        type: 'https://docunexa.io/errors/invalid-comparison-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Both documentId1 and documentId2 parameters are required for comparison.',
      });
      return;
    }

    const result = await CompareService.compareDocuments(docId1, docId2, tenantId, actorId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getComparisonHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const comparisonId = req.params['id'] as string;
    const comparison = CompareService.getComparison(comparisonId);

    if (!comparison) {
      res.status(404).json({
        type: 'https://docunexa.io/errors/comparison-not-found',
        title: 'Not Found',
        status: 404,
        detail: `Comparison record ${comparisonId} was not found.`,
      });
      return;
    }

    if (comparison.tenantId !== (req.user?.tenantId || 'DEFAULT')) {
      res.status(403).json({
        type: 'https://docunexa.io/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Access to comparison across tenant boundary is prohibited.',
      });
      return;
    }

    res.status(200).json(comparison);
  } catch (err) {
    next(err);
  }
}
