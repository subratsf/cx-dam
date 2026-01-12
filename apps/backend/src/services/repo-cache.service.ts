import { GitHubRepoPermission } from '@cx-dam/shared';
import { logger } from '../utils/logger';

interface CacheEntry {
  permissions: GitHubRepoPermission[];
  timestamp: number;
  loading: boolean;
  progress?: {
    current: number;
    total: number;
    status: string;
  };
}

/**
 * In-memory cache for user repository permissions
 * TTL: 6 hours (21600000 ms)
 */
export class RepoPermissionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

  /**
   * Get cached permissions for a user
   * Returns null if not cached or expired
   */
  get(username: string): GitHubRepoPermission[] | null {
    const entry = this.cache.get(username);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.TTL) {
      logger.debug('Cache expired for user', { username, age });
      this.cache.delete(username);
      return null;
    }

    logger.debug('Cache hit for user', { username, repoCount: entry.permissions.length, age });
    return entry.permissions;
  }

  /**
   * Check if permissions are currently being loaded for a user
   */
  isLoading(username: string): boolean {
    const entry = this.cache.get(username);
    return entry?.loading ?? false;
  }

  /**
   * Mark that we're starting to load permissions for a user
   */
  markLoading(username: string): void {
    this.cache.set(username, {
      permissions: [],
      timestamp: Date.now(),
      loading: true,
    });
  }

  /**
   * Set cached permissions for a user
   */
  set(username: string, permissions: GitHubRepoPermission[]): void {
    this.cache.set(username, {
      permissions,
      timestamp: Date.now(),
      loading: false,
    });

    logger.info('Cached permissions for user', {
      username,
      repoCount: permissions.length,
      ttl: this.TTL / 1000 / 60 / 60 + ' hours',
    });
  }

  /**
   * Update permissions incrementally (for progressive loading)
   */
  updateIncremental(username: string, newPermissions: GitHubRepoPermission[]): void {
    const entry = this.cache.get(username);
    if (entry) {
      // Merge with existing permissions
      const existingMap = new Map(entry.permissions.map(p => [p.repoFullName, p]));
      newPermissions.forEach(p => existingMap.set(p.repoFullName, p));

      entry.permissions = Array.from(existingMap.values());
      entry.timestamp = Date.now();

      logger.debug('Incrementally updated permissions', {
        username,
        totalRepos: entry.permissions.length,
      });
    } else {
      this.set(username, newPermissions);
    }
  }

  /**
   * Update loading progress
   */
  updateProgress(username: string, current: number, total: number, status: string): void {
    const entry = this.cache.get(username);
    if (entry) {
      entry.progress = { current, total, status };
    }
  }

  /**
   * Clear cache for a specific user
   */
  clear(username: string): void {
    this.cache.delete(username);
    logger.debug('Cleared cache for user', { username });
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cleared all repository permission cache', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalUsers: number; totalRepos: number } {
    let totalRepos = 0;
    this.cache.forEach((entry) => {
      totalRepos += entry.permissions.length;
    });

    return {
      totalUsers: this.cache.size,
      totalRepos,
    };
  }

  /**
   * Cleanup expired entries (run periodically)
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    this.cache.forEach((entry, username) => {
      const age = now - entry.timestamp;
      if (age > this.TTL) {
        this.cache.delete(username);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.info('Cleaned up expired cache entries', { cleaned });
    }
  }
}

// Singleton instance
export const repoPermissionCache = new RepoPermissionCache();

// Run cleanup every hour
setInterval(() => {
  repoPermissionCache.cleanup();
}, 60 * 60 * 1000);

// Clear cache on server start
logger.info('Repository permission cache initialized');
