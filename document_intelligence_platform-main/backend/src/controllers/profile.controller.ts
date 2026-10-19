import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ProfileService } from '../services/profile.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { StorageFactory } from '../services/storage.service.js';
import { Logger } from '../utils/logger.js';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB ceiling
    files: 1,
  },
});

export const avatarUploadMiddleware = avatarUpload.single('avatar');

/**
 * GET /api/v1/users/profile
 * Retrieves logged-in user profile within tenant isolation boundary.
 */
export async function getProfileHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication required.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const profile = await ProfileService.getProfile(req.user.userId, req.user.tenantId);

    res.status(200).json({
      profile,
    });
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: err.message,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/users/profile
 * Updates allowed profile identity and preference fields.
 */
export async function updateProfileHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication required.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1');
    const correlationId = (req as any).correlationId;

    const profile = await ProfileService.updateProfile(req.user.userId, req.user.tenantId, req.body, {
      ip,
      correlationId,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      profile,
    });
  } catch (err: any) {
    if (err.statusCode === 400 && err.validationErrors) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/VALIDATION_ERROR',
        title: 'Validation failed for profile update.',
        status: 400,
        instance: req.originalUrl,
        errors: err.validationErrors,
      });
      return;
    }
    next(err);
  }
}

/**
 * POST /api/v1/users/profile/avatar
 * Secure avatar photo upload with magic-byte verification and isolated storage.
 */
export async function uploadAvatarHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication required.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/MISSING_FILE',
        title: 'Avatar image file is required in multipart form data (field name: avatar).',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1');
    const correlationId = (req as any).correlationId;

    const result = await ProfileService.uploadAvatar(
      req.user.userId,
      req.user.tenantId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      { ip, correlationId }
    );

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded and updated successfully.',
      avatarUrl: result.avatarUrl,
      size: result.size,
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

/**
 * GET /api/v1/users/profile/avatar/:filename
 * Authenticated delivery of avatar image binary with tenant-scoped isolation.
 */
export async function getAvatarBinaryHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication required to access user avatars.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const filename = req.params['filename'];
    if (!filename || !/^[a-zA-Z0-9_-]+\.(jpeg|jpg|png|webp)$/.test(filename)) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Invalid avatar filename request.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const userId = filename.split('.')[0];
    const ext = filename.split('.')[1];
    const storage = StorageFactory.getStorage();
    const callerTenantId = req.user.tenantId;

    // Restrict avatar lookup strictly within caller's tenant boundary
    const storageKey = `avatars/${callerTenantId}/${userId}.${ext}`;
    const exists = await storage.hasObject(storageKey);

    let matchedKey: string | null = exists ? storageKey : null;
    if (!matchedKey) {
      // Fallback search strictly within caller's tenant directory
      const keys = await storage.listKeys(`avatars/${callerTenantId}/`);
      matchedKey = keys.find((k) => k.endsWith(`/${userId}.${ext}`)) || null;
    }

    if (!matchedKey) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: 'Avatar not found within tenant organization.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    const buffer = await storage.getObject(matchedKey);
    res.setHeader('Content-Type', `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    res.setHeader('Cache-Control', 'private, max-age=86400, no-transform');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
