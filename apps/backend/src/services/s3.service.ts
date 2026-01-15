import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sanitizeFileName, getAssetTypeFromMimeType } from '@cx-dam/shared';

export class S3Service {
  private client: S3Client;

  constructor() {
    const credentials: any = {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    };

    // Include session token if present (required for temporary credentials)
    if (config.AWS_SESSION_TOKEN) {
      credentials.sessionToken = config.AWS_SESSION_TOKEN;
    }

    this.client = new S3Client({
      region: config.AWS_REGION,
      credentials,
    });

    logger.info('S3 Service initialized', {
      region: config.AWS_REGION,
      bucket: config.S3_BUCKET_NAME,
      accessKeyId: config.AWS_ACCESS_KEY_ID.substring(0, 8) + '...',
      hasSessionToken: !!config.AWS_SESSION_TOKEN,
      credentialType: config.AWS_ACCESS_KEY_ID.startsWith('ASIA') ? 'temporary (STS)' : 'permanent (IAM)',
    });
  }

  /**
   * Generate a pre-signed URL for uploading a file to S3
   * @param workspace - GitHub repo name (e.g., "salesforcedocs/documentation")
   * @param fileName - Original file name (for new uploads) or asset name (for replacements)
   * @param mimeType - File MIME type
   * @param expiresIn - URL expiration time in seconds (default: 15 minutes)
   */
  async generatePresignedUploadUrl(
    workspace: string,
    fileName: string,
    mimeType: string,
    expiresIn: number = 900
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    try {
      const sanitizedFileName = sanitizeFileName(fileName);
      // Upload to stage bucket: s3://dam-hack/stage/<workspace>/<asset_name>
      const s3Key = `stage/${workspace}/${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: s3Key,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated pre-signed upload URL', { workspace, fileName, s3Key });

      return { uploadUrl, s3Key };
    } catch (error) {
      logger.error('Failed to generate pre-signed upload URL', { error });
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file from S3
   * @param s3Key - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   */
  async generatePresignedDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: s3Key,
      });

      const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated pre-signed download URL', { s3Key });

      return downloadUrl;
    } catch (error) {
      logger.error('Failed to generate pre-signed download URL', { error });
      throw error;
    }
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: s3Key,
      });

      await this.client.send(command);

      logger.info('Deleted S3 object', { s3Key });
    } catch (error) {
      logger.error('Failed to delete S3 object', { error });
      throw error;
    }
  }

  /**
   * Check if an object exists in S3
   * Uses HeadObject which is more efficient than GetObject
   */
  async objectExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: s3Key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      // Handle various "not found" scenarios
      if (
        error.name === 'NoSuchKey' ||
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        logger.debug('S3 object not found', { s3Key, errorName: error.name });
        return false;
      }

      // S3 can return 403 Forbidden for:
      // 1. Non-existent objects (bucket policy)
      // 2. Actual permission issues (IAM)
      // We need to distinguish between these cases
      if (error.$metadata?.httpStatusCode === 403) {
        logger.error('S3 returned 403 - permission denied or object not found', {
          s3Key,
          errorName: error.name,
          errorMessage: error.message,
          bucket: config.S3_BUCKET_NAME,
          region: config.AWS_REGION,
        });

        // For now, treat as not found but this indicates a potential configuration issue
        // TODO: Verify AWS credentials have s3:GetObject permission
        return false;
      }

      // For any other error, log and rethrow
      logger.error('S3 objectExists check failed', {
        s3Key,
        errorName: error.name,
        errorMessage: error.message,
        statusCode: error.$metadata?.httpStatusCode,
      });
      throw error;
    }
  }
}

export const s3Service = new S3Service();
