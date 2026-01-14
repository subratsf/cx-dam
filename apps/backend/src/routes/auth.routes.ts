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
  const callbackUrl = config.GITHUB_CALLBACK_URL;

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user,user:email,read:org,repo`;

  logger.info('Redirecting to GitHub OAuth', {
    callbackUrl,
  });

  res.redirect(githubAuthUrl);
});

/**
 * GitHub OAuth callback
 * GET /auth/github/callback
 */
router.get('/github/callback', async (req, res) => {
  logger.info('🔵 OAuth callback route hit', { code: req.query.code ? '***provided***' : 'missing' });

  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      logger.error('❌ No authorization code provided');
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
    logger.info('🔄 Exchanging code for access token...');
    const githubService = new GitHubService();
    const accessToken = await githubService.getAccessToken(code);
    logger.info('✅ Access token received', { tokenLength: accessToken?.length || 0 });

    // Get user info with the access token
    logger.info('🔄 Fetching GitHub user info...');
    const authenticatedGithubService = new GitHubService(accessToken);
    const githubUser = await authenticatedGithubService.getAuthenticatedUser();
    logger.info('✅ GitHub user fetched', { login: githubUser.login, id: githubUser.id });

    // Check org membership
    logger.info('🔄 Checking org membership...');
    const belongsToOrg = await authenticatedGithubService.checkOrgMembership(githubUser.login);
    logger.info('✅ Org membership checked', { belongsToOrg });

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
    logger.info('🔄 Finding or creating user in database...');
    const user = await userRepository.findOrCreate(githubUser);
    logger.info('✅ User record ready', { userId: user.id, githubId: user.githubId });

    // Create user session WITHOUT permissions (to keep JWT size small for cookies)
    // Permissions are cached server-side and retrieved when needed
    const session: UserSession = {
      user,
      githubAccessToken: accessToken,
      permissions: [], // Don't store in JWT - use cache instead
      belongsToOrg,
    };
    logger.info('🔄 Session object created', { hasUser: !!session.user, hasToken: !!session.githubAccessToken });

    // Generate JWT (small, without permissions array)
    logger.info('🔄 Generating JWT token...', { jwtSecret: config.JWT_SECRET ? 'present' : 'MISSING', jwtExpiry: config.JWT_EXPIRY });
    const token = jwt.sign(session, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY as string | number,
    } as SignOptions);
    logger.info('✅ JWT token generated', { tokenLength: token?.length || 0, tokenPreview: token ? token.substring(0, 20) + '...' : 'EMPTY' });

    logger.info('User authenticated successfully', {
      userId: user.id,
      githubId: user.githubId,
      belongsToOrg,
    });

    // Set cookie
    logger.info('🔄 Setting cookie...', { tokenLength: token?.length || 0 });
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    logger.info('✅ Auth cookie set', {
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      tokenLength: token?.length || 0,
    });

    // Redirect to frontend
    logger.info('🔄 Redirecting to frontend callback');
    res.redirect(`${config.FRONTEND_URL}/auth/callback?auth=success`);
  } catch (error) {
    logger.error('❌ GitHub OAuth callback failed', { error });
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

    // Clear cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
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
      path: '/',
    });
    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }
});

export default router;
