import { Request, Response, NextFunction } from 'express';
import { AiQualityService } from '../services/ai-quality.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import crypto from 'crypto';

export async function triggerAiEvaluationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const runId = `eval-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const analysisVersion = (req.body?.analysisVersion as string) || '1.2.0';
    const modelVersion = (req.body?.modelVersion as string) || 'gemini-1.5-pro / tesseract-v5.5';

    // Queue asynchronous background evaluation run
    setImmediate(async () => {
      try {
        await AiQualityService.runEvaluation({ analysisVersion, modelVersion });
      } catch (err) {
        console.error('[AiQualityService] Background evaluation run failed:', err);
      }
    });

    // Part E.2: Returns 202 Accepted
    res.status(202).json({
      runId,
      status: 'QUEUED',
      message: 'AI Quality benchmark evaluation queued successfully.',
      analysisVersion,
      modelVersion,
      queuedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function listAiEvaluationRunsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const runs = await AiQualityService.getEvaluationRuns(20);
    res.status(200).json({
      runs,
      totalCount: runs.length,
      latestRun: runs[0] || null,
    });
  } catch (err) {
    next(err);
  }
}
