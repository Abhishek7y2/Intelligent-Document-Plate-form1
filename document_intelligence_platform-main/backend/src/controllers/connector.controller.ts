import { Request, Response } from 'express';
import { ConnectorService } from '../services/connector.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { Logger } from '../utils/logger.js';

export async function upsertMappingHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { connectorType, documentType, fieldMappings } = req.body;
  if (!connectorType || !documentType || !fieldMappings) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'connectorType, documentType, and fieldMappings are required.' },
    });
    return;
  }

  try {
    const mapping = await ConnectorService.upsertMapping(tenantId, {
      connectorType,
      documentType,
      fieldMappings,
      version: req.body.version,
    });
    res.status(200).json({ mapping });
  } catch (err: any) {
    Logger.error({
      message: `Failed to upsert connector mapping: ${err.message}`,
      context: 'ConnectorController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'CONNECTOR_MAPPING_ERROR', message: 'Failed to save connector mapping.' },
    });
  }
}

export async function getMappingHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const connectorType = req.query.connectorType as string;
  const documentType = req.query.documentType as string;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (!connectorType || !documentType) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'connectorType and documentType query parameters are required.' },
    });
    return;
  }

  try {
    const mapping = await ConnectorService.getMapping(tenantId, connectorType as any, documentType);
    if (!mapping) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'No mapping registered for this connector and document type.' },
      });
      return;
    }
    res.status(200).json({ mapping });
  } catch (err: any) {
    Logger.error({
      message: `Failed to fetch connector mapping: ${err.message}`,
      context: 'ConnectorController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'CONNECTOR_FETCH_ERROR', message: 'Failed to retrieve connector mapping.' },
    });
  }
}

export async function signOffMappingHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'unknown_signoff_user';
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const signedMapping = await ConnectorService.signOffMapping(tenantId, id, userId);
    if (!signedMapping) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Mapping not found.' },
      });
      return;
    }
    res.status(200).json({ success: true, mapping: signedMapping });
  } catch (err: any) {
    Logger.error({
      message: `Failed to sign off mapping: ${err.message}`,
      context: 'ConnectorController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'CONNECTOR_SIGNOFF_ERROR', message: 'Failed to sign off connector mapping.' },
    });
  }
}

export async function dispatchConnectorHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { connectorType, documentId } = req.body;
  if (!connectorType || !documentId) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'connectorType and documentId are required.' },
    });
    return;
  }

  try {
    const result = await ConnectorService.dispatchToConnector(tenantId, documentId, connectorType);
    res.status(result.success ? 200 : 422).json(result);
  } catch (err: any) {
    Logger.error({
      message: `Failed to dispatch to connector: ${err.message}`,
      context: 'ConnectorController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'CONNECTOR_DISPATCH_ERROR', message: err.message || 'Failed to dispatch document.' },
    });
  }
}
