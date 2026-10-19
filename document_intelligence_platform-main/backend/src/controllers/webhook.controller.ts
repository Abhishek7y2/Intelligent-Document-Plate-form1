import { Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { Logger } from '../utils/logger.js';

export async function createSubscriptionHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { name, targetUrl, events } = req.body;
  if (!name || !targetUrl || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'name, targetUrl, and at least one event in events[] are required.' },
    });
    return;
  }

  const userId = authReq.user?.userId || 'system';

  try {
    const result = await WebhookService.createSubscription(tenantId, userId, {
      name,
      targetUrl,
      subscribedEvents: events,
    });
    res.status(201).json(result);
  } catch (err: any) {
    Logger.error({
      message: `Failed to create webhook subscription: ${err.message}`,
      context: 'WebhookController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'WEBHOOK_CREATION_ERROR', message: 'Failed to create webhook subscription.' },
    });
  }
}

export async function listSubscriptionsHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const subscriptions = await WebhookService.listSubscriptions(tenantId);
    res.status(200).json({ subscriptions, count: subscriptions.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to list webhook subscriptions: ${err.message}`,
      context: 'WebhookController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'WEBHOOK_FETCH_ERROR', message: 'Failed to list webhook subscriptions.' },
    });
  }
}

export async function deleteSubscriptionHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const deleted = await WebhookService.deleteSubscription(tenantId, id);
    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Subscription not found or already deleted.' },
      });
      return;
    }
    res.status(200).json({ success: true, message: 'Subscription deactivated.' });
  } catch (err: any) {
    Logger.error({
      message: `Failed to delete webhook subscription: ${err.message}`,
      context: 'WebhookController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'WEBHOOK_DELETE_ERROR', message: 'Failed to delete webhook subscription.' },
    });
  }
}

export async function retryDeliveryHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const updated = await WebhookService.retryDelivery(tenantId, id);
    if (!updated) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Delivery attempt not found or not retryable.' },
      });
      return;
    }
    res.status(200).json({ success: true, delivery: updated });
  } catch (err: any) {
    Logger.error({
      message: `Failed to retry delivery: ${err.message}`,
      context: 'WebhookController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'WEBHOOK_RETRY_ERROR', message: 'Failed to retry webhook delivery.' },
    });
  }
}

export async function getDeliveryHistoryHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const subscriptionId = req.query.subscriptionId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const deliveries = await WebhookService.getDeliveryHistory(tenantId, subscriptionId, limit, offset);
    res.status(200).json({ deliveries, count: deliveries.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to fetch delivery history: ${err.message}`,
      context: 'WebhookController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'WEBHOOK_HISTORY_ERROR', message: 'Failed to retrieve delivery history.' },
    });
  }
}
