import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';
import { Logger } from '../utils/logger.js';

export async function listNotificationsHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const category = req.query.category as any;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await NotificationService.listUserNotifications(tenantId, userId, {
      category,
      unreadOnly,
      limit,
      offset,
    });

    res.status(200).json(result);
  } catch (err: any) {
    Logger.error({
      message: `Failed to list notifications: ${err.message}`,
      context: 'NotificationController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'NOTIFICATION_FETCH_ERROR', message: 'Failed to retrieve notifications.' },
    });
  }
}

export async function markNotificationReadHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const updated = await NotificationService.markNotificationRead(tenantId, userId, id);
    if (!updated) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Notification not found or access denied.' },
      });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err: any) {
    Logger.error({
      message: `Failed to mark notification read: ${err.message}`,
      context: 'NotificationController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'NOTIFICATION_UPDATE_ERROR', message: 'Failed to update notification status.' },
    });
  }
}

export async function markAllNotificationsReadHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const count = await NotificationService.markAllNotificationsRead(tenantId, userId);
    res.status(200).json({ success: true, count });
  } catch (err: any) {
    Logger.error({
      message: `Failed to mark all notifications read: ${err.message}`,
      context: 'NotificationController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'NOTIFICATION_UPDATE_ERROR', message: 'Failed to update notifications.' },
    });
  }
}

export async function createStreamTicketHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId;
  const sessionId = authReq.user?.sessionId;

  if (!tenantId || !userId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant or user identity.' },
    });
    return;
  }

  try {
    const result = await NotificationService.createStreamTicket(tenantId, userId, sessionId);
    res.status(200).json(result);
  } catch (err: any) {
    Logger.error({
      message: `Failed to create stream ticket: ${err.message}`,
      context: 'NotificationController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'TICKET_CREATION_FAILED', message: 'Failed to create notification stream ticket.' },
    });
  }
}

export async function notificationStreamHandler(req: Request, res: Response): Promise<void> {
  const ticket = req.query.ticket as string;

  if (!ticket) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing stream authorization ticket.' },
    });
    return;
  }

  const ticketData = await NotificationService.redeemStreamTicket(ticket);
  if (!ticketData) {
    res.status(401).json({
      error: { code: 'INVALID_STREAM_TICKET', message: 'Stream ticket is invalid, expired, or session revoked.' },
    });
    return;
  }

  const { tenantId, userId, sessionId } = ticketData;

  // Setup Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection acknowledgement
  res.write(`data: ${JSON.stringify({ type: 'stream_connected', userId, tenantId, timestamp: new Date().toISOString() })}\n\n`);

  // Subscribe to Redis / local pub-sub fan-out
  const unsubscribe = NotificationService.subscribeToUserNotifications(
    tenantId,
    userId,
    (notif) => {
      res.write(`data: ${JSON.stringify(notif)}\n\n`);
    }
  );

  // Heartbeat ping & session revocation monitor (closes streams for revoked sessions)
  const heartbeatInterval = setInterval(async () => {
    try {
      const validation = await AuthService.validateUserAndSession(userId, tenantId, sessionId);
      if (!validation.valid) {
        res.write(`event: session_revoked\ndata: ${JSON.stringify({ reason: validation.reason })}\n\n`);
        cleanup();
        res.end();
        return;
      }
      res.write(': heartbeat\n\n');
    } catch {
      // ignore transient error
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
  };

  req.on('close', cleanup);
  res.on('finish', cleanup);
}

export async function getPreferencesHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const preferences = await NotificationService.getUserPreferences(tenantId, userId);
    res.status(200).json({ preferences });
  } catch (err: any) {
    Logger.error({
      message: `Failed to fetch preferences: ${err.message}`,
      context: 'NotificationController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'PREFERENCE_FETCH_ERROR', message: 'Failed to retrieve notification preferences.' },
    });
  }
}

export async function updatePreferenceHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { eventType, emailEnabled, inAppEnabled } = req.body;
  if (!eventType) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'eventType is required.' },
    });
    return;
  }

  try {
    const pref = await NotificationService.updatePreference(
      tenantId,
      userId,
      eventType,
      emailEnabled !== false,
      inAppEnabled !== false
    );
    res.status(200).json({ success: true, preference: pref });
  } catch (err: any) {
    Logger.error({
      message: `Failed to update preference: ${err.message}`,
      context: 'NotificationController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'PREFERENCE_UPDATE_ERROR', message: 'Failed to update preference.' },
    });
  }
}
