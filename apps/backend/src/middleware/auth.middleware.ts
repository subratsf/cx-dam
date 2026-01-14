import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserSession } from '@cx-dam/shared';
import { config } from '../config';
import { logger } from '../utils/logger';
import { repoPermissionCache } from '../services/repo-cache.service';
import { GitHubService } from '../services/github.service';

export interface AuthRequest extends Request {
  user?: UserSession;
}

/**
 * Middleware to verify JWT token and attach user session to request
 */
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.token;

    logger.debug('Auth middleware check', {
      path: req.path,
      hasCookies: !!req.cookies,
      cookieKeys: Object.keys(req.cookies || {}),
      hasToken: !!token,
      hasAuthHeader: !!authHeader,
    });

    if (!token) {
      logger.warn('No authentication token found', {
        path: req.path,
        cookies: req.cookies,
      });
      return res.status(401).json({
        success: false,
        error: {
          error: 'Unauthorized',
          message: 'No authentication token provided',
          statusCode: 401,
        },
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as UserSession;

    // Load permissions from cache if not in JWT (JWT may have empty permissions array to keep size small)
    if (!decoded.permissions || decoded.permissions.length === 0) {
      let cachedPermissions = repoPermissionCache.get(decoded.user.login);

      if (cachedPermissions && cachedPermissions.length > 0) {
        decoded.permissions = cachedPermissions;
        logger.info('Loaded permissions from cache', {
          username: decoded.user.login,
          permissionCount: cachedPermissions.length,
          sampleRepos: cachedPermissions.slice(0, 3).map(p => p.repoFullName),
        });
      } else {
        // Cache is empty - re-fetch from GitHub if we have access token
        if (decoded.githubAccessToken) {
          logger.info('Cache miss - fetching permissions from GitHub synchronously', {
            username: decoded.user.login,
          });

          try {
            // Check if already loading to prevent duplicate fetches
            if (!repoPermissionCache.isLoading(decoded.user.login)) {
              repoPermissionCache.markLoading(decoded.user.login);

              // Fetch synchronously to ensure we have permissions for this request
              const githubService = new GitHubService(decoded.githubAccessToken);
              const permissions = await githubService.getUserRepoPermissions(decoded.user.login);

              // Cache the results
              repoPermissionCache.set(decoded.user.login, permissions);
              decoded.permissions = permissions;

              logger.info('Synchronous permission fetch completed', {
                username: decoded.user.login,
                repoCount: permissions.length,
              });
            } else {
              // Already loading - wait a bit and try to get from cache
              logger.info('Permissions already being fetched, waiting...', {
                username: decoded.user.login,
              });

              // Wait briefly for the other fetch to complete
              await new Promise(resolve => setTimeout(resolve, 500));
              cachedPermissions = repoPermissionCache.get(decoded.user.login);
              decoded.permissions = cachedPermissions || [];
            }
          } catch (error) {
            logger.error('Synchronous permission fetch failed', {
              username: decoded.user.login,
              error: error instanceof Error ? error.message : String(error),
            });
            // Set empty permissions on error
            repoPermissionCache.set(decoded.user.login, []);
            decoded.permissions = [];
          }
        } else {
          logger.warn('No permissions found in JWT or cache, and no access token available', {
            username: decoded.user.login,
            cacheExists: !!cachedPermissions,
            cacheLength: cachedPermissions?.length || 0,
          });
          decoded.permissions = [];
        }
      }
    } else {
      logger.debug('Using permissions from JWT', {
        username: decoded.user.login,
        permissionCount: decoded.permissions.length,
      });
    }

    req.user = decoded;

    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    return res.status(401).json({
      success: false,
      error: {
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        statusCode: 401,
      },
    });
  }
}

/**
 * Middleware to make authentication optional
 * Attaches user if token is present and valid, but doesn't reject if missing
 */
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.token;

    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET) as UserSession;

      // Load permissions from cache if not in JWT
      if (!decoded.permissions || decoded.permissions.length === 0) {
        const cachedPermissions = repoPermissionCache.get(decoded.user.login);
        if (cachedPermissions && cachedPermissions.length > 0) {
          decoded.permissions = cachedPermissions;
        } else if (decoded.githubAccessToken) {
          // Trigger background fetch if not already loading
          if (!repoPermissionCache.isLoading(decoded.user.login)) {
            repoPermissionCache.markLoading(decoded.user.login);
            (async () => {
              try {
                const githubService = new GitHubService(decoded.githubAccessToken);
                const permissions = await githubService.getUserRepoPermissions(decoded.user.login);
                repoPermissionCache.set(decoded.user.login, permissions);
              } catch (error) {
                logger.error('Background permission fetch failed in optionalAuth', {
                  username: decoded.user.login,
                  error: error instanceof Error ? error.message : String(error),
                });
                repoPermissionCache.set(decoded.user.login, []);
              }
            })();
          }
          decoded.permissions = [];
        }
      }

      req.user = decoded;
    }

    next();
  } catch (error) {
    // Invalid token, but we continue without user
    logger.debug('Optional auth failed, continuing without user', { error });
    next();
  }
}
