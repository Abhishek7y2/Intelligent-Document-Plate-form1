import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SearchService } from '../services/search.service.js';
import { SearchQueryPayload } from '../models/search.models.js';

export async function searchHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId || 'DEFAULT';

    let payload: SearchQueryPayload;
    if (req.method === 'POST') {
      payload = {
        query: req.body.query || '',
        filters: req.body.filters || {},
        limit: req.body.limit ? parseInt(req.body.limit, 10) : undefined,
        offset: req.body.offset ? parseInt(req.body.offset, 10) : undefined,
        retrievalMode: req.body.retrievalMode || 'hybrid',
      };
    } else {
      const q = (req.query['q'] as string) || (req.query['query'] as string) || '';
      const docType = req.query['type'] as string | undefined;
      const status = req.query['status'] as string | undefined;
      const supplier = req.query['supplier'] as string | undefined;
      const page = parseInt((req.query['page'] as string) || '1', 10);
      const pageSize = parseInt((req.query['pageSize'] as string) || '10', 10);
      const mode = (req.query['mode'] as any) || 'hybrid';

      payload = {
        query: q,
        filters: {
          documentType: docType,
          status,
          supplier,
        },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        retrievalMode: mode,
      };
    }

    const response = await SearchService.search(tenantId, payload, req.user?.role);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function indexDocumentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId || 'DEFAULT';
    const documentId = req.params['id'] as string;
    const force = Boolean(req.body?.force);

    const result = await SearchService.indexDocument(documentId, tenantId, { force });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
