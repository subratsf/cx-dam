import { Router } from 'express';
import {
  validateSchema,
  CreateAssetSchema,
  SearchAssetsQuerySchema,
  ValidateNameQuerySchema,
  PresignedUrlResponse,
} from '@cx-dam/shared';
import { AuthRequest, authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { requireUploadPermission, requireReplacePermission } from '../middleware/permission.middleware';
import { assetRepository } from '../repositories/asset.repository';
import { s3Service } from '../services/s3.service';
import { bloomFilterService } from '../services/bloom-filter.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';

const router = Router();

/**
 * Request presigned URL for asset upload
 * POST /assets/upload-url
 */
router.post(
  '/upload-url',
  authenticateToken,
  requireUploadPermission,
  async (req: AuthRequest, res, next) => {
    try {
      const input = validateSchema(CreateAssetSchema, req.body);

      // Check if name already exists using Bloom Filter
      const mightExist = await bloomFilterService.mightContain(input.workspace, input.name);

      if (mightExist) {
        // Double-check with database
        const existingAsset = await assetRepository.findByNameAndWorkspace(
          input.name,
          input.workspace
        );

        if (existingAsset) {
          return next(
            new AppError(409, 'Asset with this name already exists in the workspace', {
              existingAssetId: existingAsset.id,
            })
          );
        }
      }

      // Generate presigned URL
      const { uploadUrl, s3Key } = await s3Service.generatePresignedUploadUrl(
        input.workspace,
        input.name,
        input.mimeType
      );

      // Create asset record in database
      const asset = await assetRepository.create({
        ...input,
        s3Key,
        uploadedBy: req.user!.user.id,
      });

      // Add name to Bloom Filter
      await bloomFilterService.addName(input.workspace, input.name);

      const response: PresignedUrlResponse = {
        uploadUrl,
        assetId: asset.id,
        s3Key,
      };

      logger.info('Generated upload URL', {
        assetId: asset.id,
        workspace: input.workspace,
        userId: req.user!.user.id,
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Replace an existing asset
 * PUT /assets/:id/replace
 */
router.put(
  '/:id/replace',
  authenticateToken,
  requireReplacePermission,
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { mimeType, size } = req.body;

      // Find existing asset
      const existingAsset = await assetRepository.findById(id);

      if (!existingAsset) {
        return next(new AppError(404, 'Asset not found'));
      }

      // Check workspace permission
      const hasPermission = req.user!.permissions.some(
        (p) => p.repoFullName === existingAsset.workspace
      );

      if (!hasPermission) {
        return next(new AppError(403, 'You do not have access to this workspace'));
      }

      // Generate new presigned URL
      const { uploadUrl, s3Key } = await s3Service.generatePresignedUploadUrl(
        existingAsset.workspace,
        existingAsset.name,
        mimeType
      );

      // Update asset with new S3 key
      const updatedAsset = await assetRepository.replace(id, s3Key, mimeType, size);

      // Delete old S3 object (non-blocking)
      s3Service.deleteObject(existingAsset.s3Key).catch((error) => {
        logger.error('Failed to delete old S3 object', { s3Key: existingAsset.s3Key, error });
      });

      logger.info('Generated replace URL', {
        assetId: id,
        userId: req.user!.user.id,
      });

      res.json({
        success: true,
        data: {
          uploadUrl,
          assetId: updatedAsset.id,
          s3Key,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate asset name uniqueness
 * GET /assets/validate-name?name=xyz&workspace=abc
 */
router.get('/validate-name', async (req, res, next) => {
  try {
    const query = validateSchema(ValidateNameQuerySchema, req.query);

    // Quick check with Bloom Filter
    const mightExist = await bloomFilterService.mightContain(query.workspace, query.name);

    if (!mightExist) {
      // Definitely unique
      return res.json({
        success: true,
        data: { isUnique: true },
      });
    }

    // Might exist, verify with database
    const existingAsset = await assetRepository.findByNameAndWorkspace(
      query.name,
      query.workspace
    );

    res.json({
      success: true,
      data: { isUnique: !existingAsset },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Search assets (public endpoint)
 * GET /assets/search?q=&tags=&workspace=&fileType=&page=1&limit=20
 */
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const query = validateSchema(SearchAssetsQuerySchema, req.query);

    const result = await assetRepository.search(query);

    // Generate download URLs for assets
    const assetsWithUrls = await Promise.all(
      result.data.map(async (asset) => {
        const downloadUrl = await s3Service.generatePresignedDownloadUrl(asset.s3Key);
        return { ...asset, downloadUrl };
      })
    );

    res.json({
      success: true,
      data: {
        ...result,
        data: assetsWithUrls,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get asset by ID
 * GET /assets/:id
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const asset = await assetRepository.findById(id);

    if (!asset) {
      return next(new AppError(404, 'Asset not found'));
    }

    // Generate download URL
    const downloadUrl = await s3Service.generatePresignedDownloadUrl(asset.s3Key);

    res.json({
      success: true,
      data: { ...asset, downloadUrl },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete asset
 * DELETE /assets/:id
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const asset = await assetRepository.findById(id);

    if (!asset) {
      return next(new AppError(404, 'Asset not found'));
    }

    // Check if user owns the asset or has maintainer+ permission
    const isOwner = asset.uploaded_by === req.user!.user.id;
    const hasMaintainerAccess = req.user!.permissions.some(
      (p) =>
        p.repoFullName === asset.workspace &&
        ['maintainer', 'admin'].includes(p.permission)
    );

    if (!isOwner && !hasMaintainerAccess) {
      return next(new AppError(403, 'You do not have permission to delete this asset'));
    }

    // Delete from database
    await assetRepository.delete(id);

    // Delete from S3 (non-blocking)
    s3Service.deleteObject(asset.s3Key).catch((error) => {
      logger.error('Failed to delete S3 object', { s3Key: asset.s3Key, error });
    });

    logger.info('Deleted asset', { assetId: id, userId: req.user!.user.id });

    res.json({
      success: true,
      data: { message: 'Asset deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
