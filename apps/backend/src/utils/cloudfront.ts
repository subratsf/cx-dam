import { config } from '../config';
import { logger } from './logger';

/**
 * Generate CloudFront URL from S3 key
 *
 * S3 Key patterns:
 * - Stage: s3://dam-hack/stage/<workspace>/<filename>
 * - Prod: s3://dam-hack/prod/<workspace>/<filename> (or any other state)
 *
 * CloudFront URLs:
 * - Stage: https://d37m7oxhd9ft7o.cloudfront.net/<workspace>/<filename>
 * - Prod: https://desg6kh11krs9.cloudfront.net/<workspace>/<filename>
 *
 * @param s3Key - S3 object key (e.g., "stage/salesforcedocs/cms/image.png")
 * @param state - Asset state ("Stage" or other)
 * @returns CloudFront URL
 */
export function getCloudFrontUrl(s3Key: string, state: string): string {
  try {
    // Extract the path after "stage/" or "prod/" prefix
    // S3 key format: stage/<workspace>/<filename> or prod/<workspace>/<filename>
    const pathMatch = s3Key.match(/^(stage|prod)\/(.+)$/);

    if (!pathMatch) {
      logger.warn('S3 key does not match expected pattern', { s3Key });
      // If pattern doesn't match, try to use the key as-is
      return state === 'Stage'
        ? `${config.CLOUDFRONT_STAGE_URL}/${s3Key}`
        : `${config.CLOUDFRONT_PROD_URL}/${s3Key}`;
    }

    const [, prefix, pathAfterPrefix] = pathMatch;

    // Use stage CloudFront for "Stage" state, prod for everything else
    const cloudfrontUrl = state === 'Stage'
      ? config.CLOUDFRONT_STAGE_URL
      : config.CLOUDFRONT_PROD_URL;

    // CloudFront URL doesn't include the "stage/" or "prod/" prefix
    const finalUrl = `${cloudfrontUrl}/${pathAfterPrefix}`;

    logger.debug('Generated CloudFront URL', {
      s3Key,
      state,
      cloudfrontUrl,
      finalUrl,
    });

    return finalUrl;
  } catch (error) {
    logger.error('Failed to generate CloudFront URL', { s3Key, state, error });
    // Fallback to stage URL if something goes wrong
    return `${config.CLOUDFRONT_STAGE_URL}/${s3Key}`;
  }
}

/**
 * Check if asset state should use stage CloudFront
 * @param state - Asset state
 * @returns true if should use stage CloudFront
 */
export function isStageAsset(state: string): boolean {
  return state === 'Stage';
}
