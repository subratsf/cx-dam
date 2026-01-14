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
import { userRepository } from '../repositories/user.repository';
import { s3Service } from '../services/s3.service';
import { bloomFilterService } from '../services/bloom-filter.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';

const router = Router();

/**
 * Test S3 connectivity and permissions
 * GET /assets/test-s3
 */
router.get('/test-s3', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const testKey = 'stage/test/connectivity-test.txt';

    logger.info('Testing S3 connectivity', {
      testKey,
      userId: req.user!.user.id,
    });

    // Test 1: Generate presigned URL
    const { uploadUrl } = await s3Service.generatePresignedUploadUrl(
      'test',
      'connectivity-test.txt',
      'text/plain'
    );

    logger.info('✅ Presigned URL generation successful');

    // Test 2: Check if a known object exists (or doesn't exist - both are valid)
    const exists = await s3Service.objectExists(testKey);

    logger.info('✅ Object existence check successful', { exists });

    res.json({
      success: true,
      data: {
        message: 'S3 connectivity test passed',
        tests: {
          presignedUrlGeneration: 'PASS',
          objectExistenceCheck: 'PASS',
        },
        details: {
          testKey,
          objectExists: exists,
          uploadUrl: uploadUrl.substring(0, 100) + '...',
        },
      },
    });
  } catch (error: any) {
    logger.error('S3 connectivity test failed', {
      error: error.message,
      errorName: error.name,
      statusCode: error.$metadata?.httpStatusCode,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'S3 connectivity test failed',
        details: error.message,
        statusCode: error.$metadata?.httpStatusCode,
      },
    });
  }
});

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

      logger.debug('Checking for duplicate asset', {
        name: input.name,
        workspace: input.workspace,
        userId: req.user!.user.id,
      });

      // Always check database for existing asset (regardless of Bloom filter)
      const existingAsset = await assetRepository.findByNameAndWorkspace(
        input.name,
        input.workspace
      );

      if (existingAsset) {
        logger.warn('Asset name already exists in workspace', {
          name: input.name,
          workspace: input.workspace,
          existingAssetId: existingAsset.id,
          existingAssetCreatedBy: existingAsset.createdBy,
          existingAssetUploadedBy: existingAsset.uploadedBy,
          existingAssetState: existingAsset.state,
          existingAssetS3Key: existingAsset.s3Key,
          currentUserId: req.user!.user.id,
        });
        return next(
          new AppError(409, `Asset "${input.name}" already exists in workspace "${input.workspace}"`, {
            existingAssetId: existingAsset.id,
            name: input.name,
            workspace: input.workspace,
          })
        );
      }

      // Generate presigned URL
      const { uploadUrl, s3Key } = await s3Service.generatePresignedUploadUrl(
        input.workspace,
        input.name,
        input.mimeType
      );

      // Create asset record in database
      let asset;
      try {
        asset = await assetRepository.create({
          ...input,
          tags: input.tags || [],
          s3Key,
          uploadedBy: req.user!.user.id,
        });
      } catch (dbError: any) {
        // Handle race condition - check if it's a duplicate key error
        if (dbError.code === '23505') {
          logger.warn('Duplicate asset detected during insert (race condition)', {
            name: input.name,
            workspace: input.workspace,
          });
          return next(
            new AppError(409, 'Asset with this name already exists in the workspace')
          );
        }
        throw dbError;
      }

      // NOTE: Bloom filter will be updated after upload confirmation
      // to avoid false positives from failed uploads

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
      const updatedAsset = await assetRepository.replace(id, s3Key, mimeType, size, req.user!.user.id);

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

    const result = await assetRepository.search({
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

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
 * Confirm asset upload completion
 * POST /assets/:id/confirm
 */
router.post('/:id/confirm', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const asset = await assetRepository.findById(id);

    if (!asset) {
      return next(new AppError(404, 'Asset not found'));
    }

    // Verify user owns this asset - compare by username extracted from email
    // Fetch uploader info
    const uploader = await userRepository.findById(asset.uploadedBy);

    if (!uploader) {
      logger.error('Uploader not found', { uploadedBy: asset.uploadedBy });
      return next(new AppError(404, 'Asset uploader not found'));
    }

    // Extract username from email (part before @) and remove _sfemu suffix
    const extractUsername = (email: string | null): string => {
      if (!email) return '';
      const username = email.split('@')[0];
      return username.replace(/_sfemu$/i, '').toLowerCase().trim();
    };

    const uploaderUsername = extractUsername(uploader.email);
    const currentUsername = extractUsername(req.user!.user.email);

    logger.debug('Checking asset ownership', {
      assetUploadedBy: asset.uploadedBy,
      uploaderEmail: uploader.email,
      uploaderUsername,
      currentUserId: req.user!.user.id,
      currentUserEmail: req.user!.user.email,
      currentUsername,
      match: uploaderUsername === currentUsername,
    });

    if (uploaderUsername !== currentUsername) {
      logger.warn('Asset ownership verification failed', {
        assetId: id,
        uploaderEmail: uploader.email,
        uploaderUsername,
        currentUserEmail: req.user!.user.email,
        currentUsername,
      });
      return next(new AppError(403, 'You do not have permission to confirm this asset'));
    }

    // Verify object exists in S3 with retry logic
    // S3 can have eventual consistency, so retry a few times
    let exists = false;
    let retries = 3;
    let lastError: any = null;

    for (let i = 0; i < retries; i++) {
      try {
        logger.debug('Checking S3 object existence', {
          assetId: id,
          s3Key: asset.s3Key,
          attempt: i + 1,
          maxAttempts: retries,
        });

        exists = await s3Service.objectExists(asset.s3Key);

        if (exists) {
          logger.info('S3 object verified', {
            assetId: id,
            s3Key: asset.s3Key,
            attempt: i + 1,
          });
          break;
        }

        // If not found, wait before retry (except on last attempt)
        if (i < retries - 1) {
          logger.debug('S3 object not found, retrying...', {
            assetId: id,
            s3Key: asset.s3Key,
            waitMs: 1000 * (i + 1),
          });
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      } catch (error) {
        lastError = error;
        logger.error('S3 check failed with error', {
          assetId: id,
          s3Key: asset.s3Key,
          attempt: i + 1,
          error: error instanceof Error ? error.message : String(error),
        });

        // Don't retry on actual errors (permissions, etc)
        break;
      }
    }

    if (!exists) {
      logger.warn('Asset confirmation failed - S3 object not found after retries', {
        assetId: id,
        s3Key: asset.s3Key,
        retriesAttempted: retries,
        lastError: lastError ? (lastError.message || String(lastError)) : 'Object not found',
      });

      // Delete the orphaned DB record
      await assetRepository.delete(id);
      logger.info('Deleted orphaned asset record', { assetId: id });

      return next(new AppError(404, 'Asset file not found in storage. The upload may not have completed successfully.'));
    }

    // Add name to Bloom Filter now that upload is confirmed
    await bloomFilterService.addName(asset.workspace, asset.name);

    logger.info('Asset upload confirmed', {
      assetId: id,
      s3Key: asset.s3Key,
      userId: req.user!.user.id,
      workspace: asset.workspace,
      name: asset.name,
    });

    res.json({
      success: true,
      data: { message: 'Asset upload confirmed', assetId: id },
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
 * Cleanup orphaned asset by name and workspace
 * POST /assets/cleanup-by-name
 */
router.post('/cleanup-by-name', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, workspace } = req.body;

    if (!name || !workspace) {
      return next(new AppError(400, 'Name and workspace are required'));
    }

    logger.info('Attempting to cleanup orphaned asset', { name, workspace, userId: req.user!.user.id });

    // Find the asset by name and workspace
    const asset = await assetRepository.findByNameAndWorkspace(name, workspace);

    if (!asset) {
      logger.info('No asset found to cleanup', { name, workspace });
      return res.json({
        success: true,
        data: { message: 'No orphaned asset found', cleaned: false },
      });
    }

    // Check if user owns this asset
    const uploader = await userRepository.findById(asset.uploadedBy);
    if (!uploader) {
      return next(new AppError(404, 'Asset uploader not found'));
    }

    const extractUsername = (email: string | null): string => {
      if (!email) return '';
      const username = email.split('@')[0];
      return username.replace(/_sfemu$/i, '').toLowerCase().trim();
    };

    const uploaderUsername = extractUsername(uploader.email);
    const currentUsername = extractUsername(req.user!.user.email);

    if (uploaderUsername !== currentUsername) {
      return next(new AppError(403, 'You do not have permission to cleanup this asset'));
    }

    // Check if S3 object exists
    const exists = await s3Service.objectExists(asset.s3Key);

    if (exists) {
      logger.warn('Asset file exists in S3 - not cleaning up', { assetId: asset.id, s3Key: asset.s3Key });
      return res.json({
        success: true,
        data: { message: 'Asset file exists in storage - not an orphaned record', cleaned: false },
      });
    }

    // Delete orphaned DB record
    await assetRepository.delete(asset.id);

    logger.info('Cleaned up orphaned asset', { assetId: asset.id, name, workspace, s3Key: asset.s3Key });

    res.json({
      success: true,
      data: { message: 'Orphaned asset record deleted successfully', cleaned: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cleanup orphaned asset (exists in DB but not in S3)
 * DELETE /assets/:id/cleanup
 */
router.delete('/:id/cleanup', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const asset = await assetRepository.findById(id);

    if (!asset) {
      return next(new AppError(404, 'Asset not found'));
    }

    // Check if S3 object exists
    const exists = await s3Service.objectExists(asset.s3Key);

    if (exists) {
      return next(new AppError(400, 'Asset file exists in storage - use regular delete endpoint'));
    }

    // Delete orphaned DB record
    await assetRepository.delete(id);

    logger.info('Cleaned up orphaned asset', { assetId: id, s3Key: asset.s3Key });

    res.json({
      success: true,
      data: { message: 'Orphaned asset record deleted successfully' },
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
    const isOwner = asset.uploadedBy === req.user!.user.id;
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
