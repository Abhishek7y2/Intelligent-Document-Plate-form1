import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import { MfaService } from '../services/mfa.service.js';
import { InvitationService } from '../services/invitation.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, tenantId, mfaCode, code, totpCode } = req.body;
    if (!email || !password) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Email and password are required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];
    const suppliedMfaCode = mfaCode || code || totpCode;

    const result = await AuthService.login(email, password, tenantId, ip, userAgent, suppliedMfaCode);

    if (result.mfaRequired) {
      res.status(200).json({
        mfaRequired: true,
        message: 'TOTP MFA verification required. Please provide a valid TOTP code or recovery code.',
        user: result.user,
      });
      return;
    }

    // Asynchronously send sign-in security alert via SMTP
    EmailService.sendLoginAlertEmail(result.user.email, {
      ip: String(ip || '127.0.0.1'),
      userAgent: String(userAgent || 'DocuNexa Web'),
    }).catch(() => {
      // Non-blocking security notification
    });

    res.status(200).json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Endpoint to request a one-time login OTP passcode sent via SMTP.
 */
export async function requestOtpHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Valid email address is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const otpResult = await EmailService.sendLoginOtpEmail(email, String(ip));

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${email} via SMTP.`,
      email,
      expiresInSeconds: 300,
      mode: otpResult.mode,
      smtp: EmailService.getSmtpStatus(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Endpoint to verify login OTP passcode and authenticate user.
 */
export async function verifyOtpHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Email and verification code are required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const verification = EmailService.verifyLoginOtp(email, String(code));
    if (!verification.valid) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: verification.reason || 'Invalid or expired verification code.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.loginWithEmailOnly(email, ip, userAgent);

    // Send sign-in security alert via SMTP
    EmailService.sendLoginAlertEmail(result.user.email, {
      ip: String(ip || '127.0.0.1'),
      userAgent: String(userAgent || 'DocuNexa Web'),
    }).catch(() => {});

    res.status(200).json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Endpoint to check backend SMTP configuration status.
 */
export async function smtpStatusHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    smtp: EmailService.getSmtpStatus(),
  });
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Refresh token is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.refresh(refreshToken, ip, userAgent);

    res.status(200).json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    res.status(200).json({
      message: 'Successfully logged out and session revoked.',
    });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Authentication required.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  res.status(200).json({
    user: {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
      permissions: req.user.permissions,
    },
  });
}

/**
 * Public endpoint to accept a user onboarding invitation (rate-limited)
 */
export async function acceptInviteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password, fullName } = req.body;
    if (!token || !password) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Invitation token and password are required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const newUser = await InvitationService.acceptInvitation({ token, password, fullName });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Invitation accepted and user account created successfully.',
      user: {
        userId: newUser.user_id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
        tenantId: newUser.tenant_id,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Initiates TOTP MFA enrollment (Protected)
 */
export async function enrollMfaHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

    const user = await AuthService.getUserById(req.user.userId, req.user.tenantId);
    if (!user) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: 'User account not found.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    const currentCode = req.body?.currentCode;
    const result = await MfaService.enroll(user, currentCode);
    res.status(200).json({
      status: 'SUCCESS',
      secret: result.secret,
      otpauthUrl: result.otpauthUrl,
      qrCodeDataUrl: result.qrCodeDataUrl,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies TOTP code, enables MFA, and returns 8 recovery codes (Protected)
 */
export async function verifyMfaEnrollmentHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

    const { code } = req.body;
    if (!code) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Verification code is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const user = await AuthService.getUserById(req.user.userId, req.user.tenantId);
    if (!user) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: 'User account not found.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    const result = await MfaService.verifyEnrollment(user, String(code));
    res.status(200).json({
      status: 'SUCCESS',
      message: result.message,
      recoveryCodes: result.recoveryCodes,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Disables TOTP MFA using current code and revokes all active sessions (Protected)
 */
export async function disableMfaHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

    const { code } = req.body;
    if (!code) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Current verification code or recovery code is required to disable MFA.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const user = await AuthService.getUserById(req.user.userId, req.user.tenantId);
    if (!user) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: 'User account not found.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    const result = await MfaService.disableMfa(user, String(code));
    res.status(200).json({
      status: 'SUCCESS',
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/roles (Sprint 8 Part 0.1)
 * Returns the canonical role list and which roles may override validation failures.
 */
export async function getRolesHandler(req: Request, res: Response): Promise<void> {
  const roles = [
    'Admin',
    'Reviewer',
    'Analyst',
    'Auditor',
    'contributor',
    'approver',
    'platform_operator',
  ];
  const overrideRoles = ['Admin', 'approver'];
  const rolesDetails = [
    { role: 'Admin', label: 'Administrator', canOverrideValidation: true, description: 'Full administrative control and override capability' },
    { role: 'approver', label: 'Approver', canOverrideValidation: true, description: 'Final sign-off and validation failure override' },
    { role: 'Reviewer', label: 'Reviewer', canOverrideValidation: false, description: 'Verify and edit extracted fields' },
    { role: 'Analyst', label: 'Analyst', canOverrideValidation: false, description: 'Document querying, comparison, and analysis' },
    { role: 'Auditor', label: 'Auditor', canOverrideValidation: false, description: 'Read-only inspection, audit logs, and compliance' },
    { role: 'contributor', label: 'Contributor', canOverrideValidation: false, description: 'Upload documents and track ingestion' },
    { role: 'platform_operator', label: 'Platform Operator', canOverrideValidation: false, description: 'Platform infrastructure and system telemetry' },
  ];

  res.status(200).json({
    status: 'SUCCESS',
    roles,
    overrideRoles,
    overrideAllowedRoles: overrideRoles,
    rolesDetails,
  });
}

/**
 * POST /api/v1/auth/change-password
 * Authenticated enterprise password rotation.
 */
export async function changePasswordHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Current password and new password are required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1');
    const userAgent = String(req.headers['user-agent'] || 'DocuNexa Web');
    const correlationId = (req as any).correlationId;

    const result = await AuthService.changePassword(
      req.user.userId,
      req.user.tenantId,
      currentPassword,
      newPassword,
      req.user.sessionId,
      { ip, userAgent, correlationId }
    );

    res.status(200).json({
      success: true,
      message: result.message,
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
 * GET /api/v1/auth/sessions
 * Returns real active sessions for current user with IP, browser, and OS details.
 */
export async function getSessionsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

    const sessions = await AuthService.listUserSessions(req.user.userId, req.user.tenantId, req.user.sessionId);

    res.status(200).json({
      sessions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revokes a specific active session or all other active sessions ('other').
 */
export async function revokeSessionHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

    const sessionId = req.params['id'];
    if (!sessionId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Session ID is required in URL parameter.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1');
    const correlationId = (req as any).correlationId;

    const result = await AuthService.revokeUserSession(
      req.user.userId,
      req.user.tenantId,
      sessionId,
      req.user.sessionId,
      { ip, correlationId }
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err: any) {
    if (err.statusCode === 403) {
      res.status(403).json({
        type: 'https://api.docunexa.enterprise/errors/FORBIDDEN',
        title: err.message,
        status: 403,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}

