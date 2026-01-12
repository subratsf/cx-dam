import { BloomFilter } from '@cx-dam/shared';
import { db } from '../db/client';
import { logger } from '../utils/logger';

/**
 * Service to manage Bloom Filters for name uniqueness checking
 * Each workspace has its own Bloom Filter persisted in the database
 */
export class BloomFilterService {
  private filters: Map<string, BloomFilter> = new Map();

  /**
   * Get or create a Bloom Filter for a workspace
   */
  async getFilter(workspace: string): Promise<BloomFilter> {
    // Check in-memory cache
    if (this.filters.has(workspace)) {
      return this.filters.get(workspace)!;
    }

    // Try to load from database
    const filter = await this.loadFilterFromDB(workspace);

    if (filter) {
      this.filters.set(workspace, filter);
      return filter;
    }

    // Create new filter if none exists
    return this.createFilter(workspace);
  }

  /**
   * Add a name to the workspace's Bloom Filter
   */
  async addName(workspace: string, name: string): Promise<void> {
    const filter = await this.getFilter(workspace);
    filter.add(name);

    // Persist to database asynchronously (non-blocking)
    this.persistFilterToDB(workspace, filter).catch((error) => {
      logger.error('Failed to persist Bloom Filter', { workspace, error });
    });
  }

  /**
   * Check if a name might exist in the workspace
   * Returns true if name might exist (need to verify with DB)
   * Returns false if name definitely doesn't exist
   */
  async mightContain(workspace: string, name: string): Promise<boolean> {
    const filter = await this.getFilter(workspace);
    return filter.mightContain(name);
  }

  /**
   * Load Bloom Filter from database
   */
  private async loadFilterFromDB(workspace: string): Promise<BloomFilter | null> {
    try {
      const result = await db.query(
        'SELECT bit_array, size, hash_count FROM bloom_filter_state WHERE workspace = $1',
        [workspace]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const { bit_array, size, hash_count } = result.rows[0];

      // Convert PostgreSQL bytea to number array
      const bitArray = Array.from(new Uint8Array(bit_array as Buffer)) as number[];

      return BloomFilter.import({
        bitArray,
        size,
        hashCount: hash_count,
      });
    } catch (error) {
      logger.error('Failed to load Bloom Filter from database', { workspace, error });
      return null;
    }
  }

  /**
   * Persist Bloom Filter to database
   */
  private async persistFilterToDB(workspace: string, filter: BloomFilter): Promise<void> {
    try {
      const exported = filter.export();
      const bitArray = Buffer.from(exported.bitArray);

      await db.query(
        `INSERT INTO bloom_filter_state (workspace, bit_array, size, hash_count, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (workspace)
         DO UPDATE SET
           bit_array = EXCLUDED.bit_array,
           size = EXCLUDED.size,
           hash_count = EXCLUDED.hash_count,
           items_count = bloom_filter_state.items_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [workspace, bitArray, exported.size, exported.hashCount]
      );

      logger.debug('Persisted Bloom Filter to database', { workspace });
    } catch (error) {
      logger.error('Failed to persist Bloom Filter to database', { workspace, error });
      throw error;
    }
  }

  /**
   * Create a new Bloom Filter for a workspace
   */
  private async createFilter(workspace: string): Promise<BloomFilter> {
    const filter = new BloomFilter(100000, 0.01); // Expected 100k items, 1% false positive rate
    this.filters.set(workspace, filter);

    // Initialize with existing names from database
    await this.initializeFilterWithExistingNames(workspace, filter);

    return filter;
  }

  /**
   * Initialize a new filter with existing asset names from the database
   */
  private async initializeFilterWithExistingNames(
    workspace: string,
    filter: BloomFilter
  ): Promise<void> {
    try {
      const result = await db.query('SELECT name FROM assets WHERE workspace = $1', [workspace]);

      for (const row of result.rows) {
        filter.add(row.name);
      }

      logger.info('Initialized Bloom Filter with existing names', {
        workspace,
        count: result.rows.length,
      });

      // Persist the initialized filter
      await this.persistFilterToDB(workspace, filter);
    } catch (error) {
      logger.error('Failed to initialize Bloom Filter', { workspace, error });
      throw error;
    }
  }

  /**
   * Clear all in-memory filters (useful for testing or memory management)
   */
  clearCache(): void {
    this.filters.clear();
    logger.info('Cleared Bloom Filter cache');
  }
}

export const bloomFilterService = new BloomFilterService();
