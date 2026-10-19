import { Request, Response } from 'express';
import { QaService, QaValidationError, CitationAccessDeniedError } from '../services/qa.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { Logger } from '../utils/logger.js';

export async function askQuestionHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';
  const correlationId = (req.headers['x-correlation-id'] as string) || `CORR-${Date.now()}`;

  if (!tenantId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Missing tenant identity.',
      },
    });
    return;
  }

  try {
    const result = await QaService.askQuestion(
      tenantId,
      userId,
      {
        question: req.body.question,
        documentId: req.body.documentId,
        documentIds: req.body.documentIds,
        sessionId: req.body.sessionId,
        maxTokens: req.body.maxTokens,
        temperature: req.body.temperature,
      },
      correlationId,
      authReq.user?.role
    );

    res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof QaValidationError) {
      res.status(400).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }

    Logger.error({
      message: `Grounded Q&A request failed: ${err.message}`,
      context: 'QaController',
      error: err,
    });

    res.status(500).json({
      error: {
        code: 'QA_PROCESSING_ERROR',
        message: 'An internal error occurred while processing the Q&A request.',
      },
    });
  }
}

export async function verifyCitationHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role || 'Viewer';
  const documentId = req.body.documentId || req.params['documentId'];
  const citationId = req.body.citationId || req.params['id'];

  if (!tenantId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Missing tenant identity.',
      },
    });
    return;
  }

  if (!documentId) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing mandatory documentId parameter for citation verification.',
      },
    });
    return;
  }

  try {
    const result = await QaService.verifyCitationAccess(
      tenantId,
      userRole,
      documentId,
      citationId
    );

    res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof CitationAccessDeniedError) {
      res.status(403).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'CITATION_VERIFICATION_ERROR',
        message: 'Failed to verify citation access.',
      },
    });
  }
}

export async function listQaDocumentsHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
    return;
  }

  try {
    const docs = await QaService.getAvailableDocuments(tenantId, authReq.user?.role);
    res.status(200).json({
      documents: docs,
      totalCount: docs.length,
    });
  } catch (_err: any) {
    res.status(500).json({
      error: {
        code: 'DOCUMENT_RETRIEVAL_ERROR',
        message: 'Failed to retrieve available Q&A documents.',
      },
    });
  }
}

export async function submitFeedbackHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const traceId = req.params['traceId'];
  const feedback = req.body.feedback;

  if (!tenantId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
    return;
  }

  if (!traceId || !feedback || !['HELPFUL', 'NOT_HELPFUL', 'FLAGGED'].includes(feedback)) {
    res.status(400).json({
      error: {
        code: 'INVALID_FEEDBACK',
        message: "Invalid feedback payload. Must provide traceId and feedback ('HELPFUL' | 'NOT_HELPFUL' | 'FLAGGED').",
      },
    });
    return;
  }

  try {
    const success = await QaService.submitFeedback(tenantId, traceId, feedback);
    res.status(200).json({ success });
  } catch (_err: any) {
    res.status(500).json({
      error: {
        code: 'FEEDBACK_ERROR',
        message: 'Failed to record feedback.',
      },
    });
  }
}
