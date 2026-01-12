import { Response, NextFunction } from 'express';
import { PermissionLevel, canUploadAsset, canReplaceAsset } from '@cx-dam/shared';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';

/**
 * Check if user has permission to upload to a workspace
 */
export function requireUploadPermission(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        error: 'Unauthorized',
        message: 'Authentication required',
        statusCode: 401,
      },
    });
  }

  const workspace = req.body.workspace || req.query.workspace;

  if (!workspace) {
    return res.status(400).json({
      success: false,
      error: {
        error: 'BadRequest',
        message: 'Workspace is required',
        statusCode: 400,
      },
    });
  }

  // Find permission for the workspace
  const permission = req.user.permissions.find((p) => p.repoFullName === workspace);

  if (!permission || !canUploadAsset(permission.permission)) {
    logger.warn('Upload permission denied', {
      userId: req.user.user.id,
      workspace,
      permission: permission?.permission,
    });

    return res.status(403).json({
      success: false,
      error: {
        error: 'Forbidden',
        message: 'You do not have write access to this workspace',
        statusCode: 403,
      },
    });
  }

  next();
}

/**
 * Check if user has permission to replace an asset
 */
export function requireReplacePermission(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        error: 'Unauthorized',
        message: 'Authentication required',
        statusCode: 401,
      },
    });
  }

  const workspace = req.body.workspace || req.query.workspace;

  if (!workspace) {
    return res.status(400).json({
      success: false,
      error: {
        error: 'BadRequest',
        message: 'Workspace is required',
        statusCode: 400,
      },
    });
  }

  const permission = req.user.permissions.find((p) => p.repoFullName === workspace);

  if (!permission || !canReplaceAsset(permission.permission, req.user.belongsToOrg)) {
    logger.warn('Replace permission denied', {
      userId: req.user.user.id,
      workspace,
      permission: permission?.permission,
      belongsToOrg: req.user.belongsToOrg,
    });

    return res.status(403).json({
      success: false,
      error: {
        error: 'Forbidden',
        message: 'You must be a maintainer in the salesforcedocs org to replace assets',
        statusCode: 403,
      },
    });
  }

  next();
}
