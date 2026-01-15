import { Asset, CreateAssetInput, UpdateAssetInput, SearchAssetsQuery, PaginatedResponse } from '@cx-dam/shared';
import { db } from '../db/client';
import { logger } from '../utils/logger';
import { config } from '../config';

export class AssetRepository {
  /**
   * Map database row (snake_case) to Asset type (camelCase)
   */
  private mapRowToAsset(row: any): Asset {
    return {
      id: row.id,
      name: row.name,
      workspace: row.workspace,
      tags: row.tags,
      fileType: row.file_type,
      mimeType: row.mime_type,
      size: row.size,
      s3Key: row.s3_key,
      s3Bucket: row.s3_bucket,
      state: row.state,
      createdBy: row.created_by,
      createdOn: row.created_on,
      modifiedBy: row.modified_by,
      modifiedOn: row.modified_on,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Create a new asset
   */
  async create(data: CreateAssetInput & { s3Key: string; uploadedBy: string }): Promise<Asset> {
    try {
      const result = await db.query(
        `INSERT INTO assets (name, workspace, tags, file_type, mime_type, size, s3_key, s3_bucket, state, created_by, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          data.name,
          data.workspace,
          data.tags,
          this.getFileTypeFromMimeType(data.mimeType),
          data.mimeType,
          data.size,
          data.s3Key,
          config.S3_BUCKET_NAME,
          'Stage', // Initial state is always Stage
          data.uploadedBy, // created_by
          data.uploadedBy, // uploaded_by
        ]
      );

      const asset = this.mapRowToAsset(result.rows[0]);
      logger.info('Created new asset', { assetId: asset.id, name: data.name });

      return asset;
    } catch (error) {
      logger.error('Failed to create asset', { data, error });
      throw error;
    }
  }

  /**
   * Find asset by ID
   */
  async findById(id: string): Promise<Asset | null> {
    try {
      const result = await db.query('SELECT * FROM assets WHERE id = $1', [id]);
      return result.rows[0] ? this.mapRowToAsset(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find asset by ID', { id, error });
      throw error;
    }
  }

  /**
   * Find asset by name and workspace
   */
  async findByNameAndWorkspace(name: string, workspace: string): Promise<Asset | null> {
    try {
      logger.debug('Querying asset by name and workspace', {
        name,
        workspace,
        nameType: typeof name,
        workspaceType: typeof workspace,
      });

      const result = await db.query(
        'SELECT * FROM assets WHERE name = $1 AND workspace = $2',
        [name, workspace]
      );

      const found = result.rows[0] ? this.mapRowToAsset(result.rows[0]) : null;

      logger.debug('Asset query result', {
        name,
        workspace,
        found: !!found,
        foundAssetId: found?.id,
        rowCount: result.rowCount,
      });

      return found;
    } catch (error) {
      logger.error('Failed to find asset by name and workspace', { name, workspace, error });
      throw error;
    }
  }

  /**
   * Update asset
   */
  async update(id: string, data: UpdateAssetInput & { modifiedBy?: string }): Promise<Asset> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.tags) {
        fields.push(`tags = $${paramIndex++}`);
        values.push(data.tags);
      }
      if (data.modifiedBy) {
        fields.push(`modified_by = $${paramIndex++}`);
        values.push(data.modifiedBy);
        fields.push(`modified_on = CURRENT_TIMESTAMP`);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE assets SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      logger.info('Updated asset', { assetId: id });

      return this.mapRowToAsset(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update asset', { id, error });
      throw error;
    }
  }

  /**
   * Replace asset (update s3_key and other metadata)
   */
  async replace(id: string, s3Key: string, mimeType: string, size: number, modifiedBy: string): Promise<Asset> {
    try {
      const result = await db.query(
        `UPDATE assets
         SET s3_key = $1, mime_type = $2, size = $3, file_type = $4, modified_by = $5, modified_on = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [s3Key, mimeType, size, this.getFileTypeFromMimeType(mimeType), modifiedBy, id]
      );

      logger.info('Replaced asset', { assetId: id });

      return this.mapRowToAsset(result.rows[0]);
    } catch (error) {
      logger.error('Failed to replace asset', { id, error });
      throw error;
    }
  }

  /**
   * Delete asset
   */
  async delete(id: string): Promise<void> {
    try {
      await db.query('DELETE FROM assets WHERE id = $1', [id]);
      logger.info('Deleted asset', { assetId: id });
    } catch (error) {
      logger.error('Failed to delete asset', { id, error });
      throw error;
    }
  }

  /**
   * Search assets with pagination
   */
  async search(query: SearchAssetsQuery): Promise<PaginatedResponse<Asset>> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Filter by workspace
      if (query.workspace) {
        conditions.push(`workspace = $${paramIndex++}`);
        values.push(query.workspace);
      }

      // Filter by file type
      if (query.fileType) {
        conditions.push(`file_type = $${paramIndex++}`);
        values.push(query.fileType);
      }

      // Search by name (full-text search) - also search in tags and workspace
      if (query.q) {
        // Search in name, workspace, and tags with partial matching
        const searchPattern = `%${query.q}%`;
        conditions.push(`(
          name ILIKE $${paramIndex}
          OR workspace ILIKE $${paramIndex}
          OR to_tsvector('english', name) @@ plainto_tsquery('english', $${paramIndex})
          OR EXISTS (
            SELECT 1 FROM unnest(tags) AS tag
            WHERE tag ILIKE $${paramIndex}
          )
        )`);
        values.push(searchPattern);
        paramIndex++;
      }

      // Filter by tags (exact match on comma-separated tags)
      if (query.tags) {
        const tagArray = query.tags.split(',').map((t) => t.trim());
        conditions.push(`tags && $${paramIndex}::text[]`);
        values.push(tagArray);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total results
      const countQuery = `SELECT COUNT(*) as count FROM assets ${whereClause}`;
      logger.debug('Executing count query', { query: countQuery, values });

      const countResult = await db.query<{ count: string }>(
        countQuery,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Calculate pagination
      const offset = (query.page - 1) * query.limit;
      values.push(query.limit, offset);

      // Get paginated results
      const result = await db.query(
        `SELECT * FROM assets ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        values
      );

      return {
        data: result.rows.map(row => this.mapRowToAsset(row)),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    } catch (error) {
      logger.error('Failed to search assets', {
        query,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  /**
   * Get all asset names for a workspace (for Bloom Filter initialization)
   */
  async getAllNamesForWorkspace(workspace: string): Promise<string[]> {
    try {
      const result = await db.query<{ name: string }>(
        'SELECT name FROM assets WHERE workspace = $1',
        [workspace]
      );
      return result.rows.map((row) => row.name);
    } catch (error) {
      logger.error('Failed to get asset names for workspace', { workspace, error });
      throw error;
    }
  }

  private getFileTypeFromMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar'))
      return 'archive';
    if (mimeType.includes('pdf') || mimeType.includes('doc') || mimeType.includes('text'))
      return 'document';
    return 'other';
  }
}

export const assetRepository = new AssetRepository();
