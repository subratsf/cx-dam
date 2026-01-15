import { Response, NextFunction } from 'express';
import { PermissionLevel, canUploadAsset, canReplaceAsset } from '@cx-dam/shared';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';
import { assetRepository } from '../repositories/asset.repository';

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

  logger.debug('Checking upload permission', {
    userId: req.user.user.id,
    username: req.user.user.login,
    workspace,
    totalPermissions: req.user.permissions.length,
    hasPermission: !!permission,
    permissionLevel: permission?.permission,
    canUpload: permission ? canUploadAsset(permission.permission) : false,
    allWorkspaces: req.user.permissions.map(p => p.repoFullName).slice(0, 5), // Show first 5
  });

  if (!permission || !canUploadAsset(permission.permission)) {
    logger.warn('Upload permission denied', {
      userId: req.user.user.id,
      username: req.user.user.login,
      workspace,
      permission: permission?.permission,
      hasPermission: !!permission,
      totalPermissions: req.user.permissions.length,
      availableWorkspaces: req.user.permissions.map(p => p.repoFullName),
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
 * For replace endpoint, workspace is obtained from the existing asset (via :id param)
 */
export async function requireReplacePermission(req: AuthRequest, res: Response, next: NextFunction) {
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

  // For replace endpoint, get workspace from the asset ID in params
  let workspace: string | undefined;
  
  if (req.params?.id) {
    // This is a replace endpoint - fetch the asset to get its workspace
    try {
      const asset = await assetRepository.findById(req.params.id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          error: {
            error: 'NotFound',
            message: 'Asset not found',
            statusCode: 404,
          },
        });
      }
      workspace = asset.workspace;
    } catch (error) {
      logger.error('Failed to fetch asset for permission check', { 
        assetId: req.params.id, 
        error 
      });
      return res.status(500).json({
        success: false,
        error: {
          error: 'InternalServerError',
          message: 'Failed to verify asset permissions',
          statusCode: 500,
        },
      });
    }
  } else {
    // Fallback: try to get workspace from body or query (for other endpoints)
    workspace = req.body.workspace || req.query.workspace;
  }

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
