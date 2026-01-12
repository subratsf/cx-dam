import { Router } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserSession } from '@cx-dam/shared';
import { config } from '../config';
import { logger } from '../utils/logger';
import { GitHubService } from '../services/github.service';
import { userRepository } from '../repositories/user.repository';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { repoPermissionCache } from '../services/repo-cache.service';

const router = Router();

/**
 * GitHub OAuth login redirect
 * GET /auth/github
 */
router.get('/github', (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&redirect_uri=${config.GITHUB_CALLBACK_URL}&scope=read:user,user:email,read:org,repo`;
  res.redirect(githubAuthUrl);
});

/**
 * GitHub OAuth callback
 * GET /auth/github/callback
 */
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          error: 'BadRequest',
          message: 'Authorization code is required',
          statusCode: 400,
        },
      });
    }

    // Exchange code for access token
    const githubService = new GitHubService();
    const accessToken = await githubService.getAccessToken(code);

    // Get user info with the access token
    const authenticatedGithubService = new GitHubService(accessToken);
    const githubUser = await authenticatedGithubService.getAuthenticatedUser();

    // Check org membership
    const belongsToOrg = await authenticatedGithubService.checkOrgMembership(githubUser.login);

    // Get repository permissions from cache or fetch synchronously
    let permissions = repoPermissionCache.get(githubUser.login);

    if (!permissions) {
      logger.info('⏳ Fetching repository permissions synchronously...', { username: githubUser.login });

      try {
        // Fetch synchronously to ensure we have data before login completes
        permissions = await authenticatedGithubService.getUserRepoPermissions(githubUser.login);

        // Cache the results
        repoPermissionCache.set(githubUser.login, permissions);

        logger.info('✅ Repository permissions fetched successfully', {
          username: githubUser.login,
          repoCount: permissions.length
        });
      } catch (error) {
        logger.error('❌ Failed to fetch repository permissions', {
          username: githubUser.login,
          error: error instanceof Error ? error.message : String(error)
        });

        // Return empty array on error
        permissions = [];
      }
    } else {
      logger.info('✓ Using cached permissions', {
        username: githubUser.login,
        repoCount: permissions.length,
      });
    }

    // Find or create user in database
    const user = await userRepository.findOrCreate(githubUser);

    // Create user session
    const session: UserSession = {
      user,
      githubAccessToken: accessToken,
      permissions,
      belongsToOrg,
    };

    // Generate JWT
    const token = jwt.sign(session, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY as string | number,
    } as SignOptions);

    logger.info('User authenticated successfully', {
      userId: user.id,
      githubId: user.githubId,
      belongsToOrg,
    });

    // Set cookie and redirect to frontend
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: 'localhost', // Share cookie across all localhost ports
      path: '/',
    });

    logger.info('Setting auth cookie', {
      domain: 'localhost',
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.redirect(`${config.FRONTEND_URL}/auth/callback?auth=success`);
  } catch (error) {
    logger.error('GitHub OAuth callback failed', { error });
    res.redirect(`${config.FRONTEND_URL}/auth/callback?auth=failed`);
  }
});

/**
 * Get current user session
 * GET /auth/me
 */
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  // Check if we have fresh cached permissions
  const cachedPermissions = repoPermissionCache.get(req.user!.user.login);

  res.json({
    success: true,
    data: {
      user: req.user!.user,
      permissions: cachedPermissions || req.user!.permissions,
      belongsToOrg: req.user!.belongsToOrg,
    },
  });
});

/**
 * Refresh repository permissions
 * GET /auth/refresh-permissions
 */
router.get('/refresh-permissions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const username = req.user!.user.login;
    const githubAccessToken = req.user!.githubAccessToken;

    logger.info('Manual permission refresh requested', { username });

    // Clear cache to force refresh
    repoPermissionCache.clear(username);

    // Fetch fresh permissions
    const githubService = new GitHubService(githubAccessToken);
    const permissions = await githubService.getUserRepoPermissions(username);

    // Cache the results
    repoPermissionCache.set(username, permissions);

    logger.info('Permissions refreshed successfully', {
      username,
      repoCount: permissions.length,
    });

    res.json({
      success: true,
      data: {
        permissions,
        count: permissions.length,
      },
    });
  } catch (error) {
    logger.error('Failed to refresh permissions', { error });
    res.status(500).json({
      success: false,
      error: {
        error: 'InternalServerError',
        message: 'Failed to refresh permissions',
        statusCode: 500,
      },
    });
  }
});

/**
 * Logout
 * POST /auth/logout
 */
router.post('/logout', authenticateToken, (req: AuthRequest, res) => {
  try {
    // Clear repository permission cache for this user
    if (req.user) {
      const username = req.user.user.login;
      repoPermissionCache.clear(username);
      logger.info('User logged out, cache cleared', { username });
    }

    // Clear cookie with same options used when setting it
    res.clearCookie('token', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: 'localhost',
      path: '/',
    });

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    logger.error('Logout failed', { error });
    // Still clear the cookie even if there's an error
    res.clearCookie('token', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: 'localhost',
      path: '/',
    });
    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }
});

export default router;
