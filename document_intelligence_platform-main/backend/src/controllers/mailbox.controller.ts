import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { EmailIntakeService } from '../services/email-intake.service.js';

export async function listMailboxesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
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

    const mailboxes = await EmailIntakeService.listMailboxes(tenantId);

    // Ensure no internal connection credentials leak to response
    const sanitized = mailboxes.map((m) => ({
      id: m.id,
      tenantId: m.tenant_id,
      address: m.address,
      allowedSenderDomains: m.allowed_sender_domains,
      defaultUploaderUserId: m.default_uploader_user_id,
      isActive: m.is_active,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    res.status(200).json({
      status: 'SUCCESS',
      tenantId,
      data: sanitized,
    });
  } catch (err) {
    next(err);
  }
}

export async function createMailboxHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing user or tenant identity.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const { address, allowedSenderDomains, defaultUploaderUserId } = req.body || {};

    if (!address) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Mailbox address is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const record = await EmailIntakeService.createMailbox({
      tenantId,
      address,
      allowedSenderDomains: Array.isArray(allowedSenderDomains) ? allowedSenderDomains : [],
      defaultUploaderUserId: defaultUploaderUserId || userId,
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: `Intake mailbox created for ${record.address}.`,
      data: {
        id: record.id,
        tenantId: record.tenant_id,
        address: record.address,
        allowedSenderDomains: record.allowed_sender_domains,
        defaultUploaderUserId: record.default_uploader_user_id,
        isActive: record.is_active,
        createdAt: record.created_at,
      },
    });
  } catch (err: any) {
    if (err.statusCode === 400) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: err.message,
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}

export async function updateMailboxHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const mailboxId = req.params['id'];

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const { allowedSenderDomains, isActive, defaultUploaderUserId } = req.body || {};

    const updated = await EmailIntakeService.updateMailbox(tenantId, mailboxId, {
      allowedSenderDomains,
      isActive,
      defaultUploaderUserId,
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Intake mailbox configuration updated.',
      data: {
        id: updated.id,
        tenantId: updated.tenant_id,
        address: updated.address,
        allowedSenderDomains: updated.allowed_sender_domains,
        defaultUploaderUserId: updated.default_uploader_user_id,
        isActive: updated.is_active,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/MAILBOX_NOT_FOUND',
        title: err.message,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}
