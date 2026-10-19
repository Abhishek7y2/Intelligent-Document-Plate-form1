import { Request, Response, NextFunction } from 'express';
import { SchemaService } from '../services/schema.service.js';
import {
  CreateDocumentTypeSchema,
  UpdateDocumentTypeSchema,
  CreateTemplateSchema,
  CreatePolicySchema,
  EvaluatePolicySchema,
  TemplateFieldSchema,
} from '../utils/schema-validator.js';

/**
 * Strict Tenant Identity Extractor.
 * Security Invariant:
 * Tenant identity MUST derive solely from the cryptographically verified JWT (`req.user.tenantId`).
 * Untrusted client headers or query parameters cannot inject or spoof tenant identity.
 */
function getAuthenticatedTenant(req: Request): string {
  const user = (req as any).user;
  if (!user || !user.tenantId) {
    const err: any = new Error('Authentication required: Missing verified tenant identity.');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return user.tenantId;
}

export async function listDocumentTypesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const documentTypes = await SchemaService.listDocumentTypes(tenantId);
    res.json({
      success: true,
      data: documentTypes,
      total: documentTypes.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocumentTypeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const { id } = req.params;
    const documentType = await SchemaService.getDocumentType(id, tenantId);

    if (!documentType) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: `Document type '${id}' was not found.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.json({
      success: true,
      data: documentType,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDocumentTypeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const userId = (req as any).user?.userId;
    const validated = CreateDocumentTypeSchema.parse(req.body);

    const docType = await SchemaService.createDocumentType(validated, tenantId, userId);
    res.status(201).json({
      success: true,
      data: docType,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDocumentTypeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const { id } = req.params;
    const validated = UpdateDocumentTypeSchema.parse(req.body);

    const updated = await SchemaService.updateDocumentType(id, validated, tenantId);
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function listTemplatesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const typeId = req.params.typeId || (req.query.typeId as string) || (req.query.documentTypeId as string);
    if (!typeId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/VALIDATION_ERROR',
        title: 'Document type identifier is required (as path parameter or documentTypeId query parameter).',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }
    const templates = await SchemaService.listTemplates(typeId, tenantId);
    res.json({
      success: true,
      data: templates,
      total: templates.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const { typeId, version } = req.params;
    const template = await SchemaService.getTemplate(typeId, version, tenantId);

    if (!template) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: `Template version '${version}' for '${typeId}' was not found.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDraftTemplateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const userId = (req as any).user?.userId;
    const { typeId } = req.params;
    const validated = CreateTemplateSchema.parse(req.body);

    const template = await SchemaService.createDraftTemplate(typeId, validated, tenantId, userId);
    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (err) {
    next(err);
  }
}

export async function publishTemplateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const userId = (req as any).user?.userId;
    const { typeId, version } = req.params;

    const published = await SchemaService.publishTemplate(typeId, version, tenantId, userId);
    res.json({
      success: true,
      data: published,
      message: `Template version ${version} successfully published and activated for ${typeId}.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function validateTemplateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/VALIDATION_ERROR',
        title: 'Fields must be an array of field definitions.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const errors: string[] = [];
    fields.forEach((field, index) => {
      const parsed = TemplateFieldSchema.safeParse(field);
      if (!parsed.success) {
        errors.push(`Field index ${index} (${field?.key || 'unknown'}): ${parsed.error.issues.map((i) => i.message).join(', ')}`);
      }
    });

    if (errors.length > 0) {
      res.status(422).json({
        type: 'https://api.docunexa.enterprise/errors/UNPROCESSABLE_ENTITY',
        title: 'Template validation failed.',
        status: 422,
        detail: errors.join('; '),
        instance: req.originalUrl,
        errors,
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      message: 'All field definitions and validation constraints are valid.',
    });
  } catch (err) {
    next(err);
  }
}

export async function listPoliciesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const typeId = req.params.typeId || (req.query.typeId as string) || (req.query.documentTypeId as string);
    if (!typeId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/VALIDATION_ERROR',
        title: 'Document type identifier is required (as path parameter or documentTypeId query parameter).',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }
    const policies = await SchemaService.listPolicies(typeId, tenantId);
    res.json({
      success: true,
      data: policies,
      total: policies.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPolicyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const { id } = req.params;
    const policy = await SchemaService.getPolicy(id, tenantId);

    if (!policy) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
        title: `Policy '${id}' was not found.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.json({
      success: true,
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDraftPolicyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const userId = (req as any).user?.userId;
    const { typeId } = req.params;
    const validated = CreatePolicySchema.parse(req.body);

    const policy = await SchemaService.createDraftPolicy(typeId, validated, tenantId, userId);
    res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

export async function publishPolicyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const { id } = req.params;

    const published = await SchemaService.publishPolicy(id, tenantId);
    res.json({
      success: true,
      data: published,
      message: `Policy '${published.name}' (${published.version}) successfully published and activated.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function evaluatePolicyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getAuthenticatedTenant(req);
    const { id } = req.params;
    const validated = EvaluatePolicySchema.parse(req.body);

    const result = await SchemaService.evaluatePolicy(id, validated.data, tenantId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
