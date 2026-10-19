import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ErpPublisherService } from '../services/erp-publisher.service.js';
import { OcrNotFoundError } from '../services/intake.service.js';

export async function publishDocumentToErpHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const documentId = req.params.id;
  const tenantId = req.user!.tenantId;
  const options = req.body || {};

  try {
    const result = await ErpPublisherService.publishDocument(documentId, tenantId, options);
    const status = result.success ? 200 : 502;
    res.status(status).json(result);
  } catch (err: any) {
    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/ERP_DISPATCH_ERROR',
      title: 'Failed to publish document to ERP.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function getErpPublicationStatusHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const documentId = req.params.id;
  const tenantId = req.user!.tenantId;

  try {
    const publication = ErpPublisherService.getPublicationRecord(documentId, tenantId);
    if (!publication) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/PUBLICATION_NOT_FOUND',
        title: 'ERP publication record not found for document.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(200).json(publication);
  } catch (err: any) {
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to retrieve ERP publication status.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}
