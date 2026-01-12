import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sanitizeFileName, getAssetTypeFromMimeType } from '@cx-dam/shared';

export class S3Service {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Generate a pre-signed URL for uploading a file to S3
   * @param workspace - GitHub repo name (e.g., "salesforcedocs/documentation")
   * @param fileName - Original file name
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
      const assetType = getAssetTypeFromMimeType(mimeType);
      const sanitizedFileName = sanitizeFileName(fileName);
      const timestamp = Date.now();
      const s3Key = `${workspace}/${assetType}s/${timestamp}-${sanitizedFileName}`;

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
   */
  async objectExists(s3Key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: s3Key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }
}

export const s3Service = new S3Service();
