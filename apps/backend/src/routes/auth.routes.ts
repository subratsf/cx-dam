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
 * Get GitHub OAuth URL (for VS Code extension)
 * GET /auth/github/url
 * Returns JSON instead of redirecting
 */
router.get('/github/url', (req, res) => {
  const callbackUrl = config.GITHUB_CALLBACK_URL;

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user,user:email,read:org,repo`;

  logger.info('Returning GitHub OAuth URL for VS Code extension', {
    callbackUrl,
  });

  res.json({ url: githubAuthUrl });
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

    // Check if this is a VS Code extension callback via state parameter
    const state = req.query.state as string;
    const isVSCode = state === 'vscode';

    if (isVSCode) {
      // Redirect to VS Code bridge page with code
      const vscodeCallbackUrl = `${config.FRONTEND_URL}/vscode-auth-callback.html?code=${encodeURIComponent(code as string)}`;
      logger.info('🔄 Redirecting to VS Code bridge page', { vscodeCallbackUrl });
      res.redirect(vscodeCallbackUrl);
    } else {
      // Regular web flow - redirect to frontend
      logger.info('🔄 Redirecting to frontend callback');
      res.redirect(`${config.FRONTEND_URL}/auth/callback?auth=success`);
    }
  } catch (error) {
    logger.error('❌ GitHub OAuth callback failed', { error });
    res.redirect(`${config.FRONTEND_URL}/auth/callback?auth=failed`);
  }
});

/**
 * GitHub OAuth callback (for VS Code extension)
 * POST /auth/github/callback
 * Accepts code in request body and returns JSON with token
 */
router.post('/github/callback', async (req, res) => {
  logger.info('🔵 OAuth callback (POST) route hit for VS Code extension', { hasCode: !!req.body.code });

  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      logger.error('❌ No authorization code provided in POST body');
      return res.status(400).json({
        success: false,
        error: {
          error: 'BadRequest',
          message: 'Authorization code is required in request body',
          statusCode: 400,
        },
      });
    }

    // Exchange code for access token
    logger.info('🔄 Exchanging code for access token (VS Code)...');
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

    // Get repository permissions
    let permissions = repoPermissionCache.get(githubUser.login);

    if (!permissions) {
      logger.info('⏳ Fetching repository permissions...', { username: githubUser.login });
      try {
        permissions = await authenticatedGithubService.getUserRepoPermissions(githubUser.login);
        repoPermissionCache.set(githubUser.login, permissions);
        logger.info('✅ Repository permissions fetched', { repoCount: permissions.length });
      } catch (error) {
        logger.error('❌ Failed to fetch repository permissions', { error });
        permissions = [];
      }
    }

    // Find or create user in database
    logger.info('🔄 Finding or creating user...');
    const user = await userRepository.findOrCreate(githubUser);
    logger.info('✅ User record ready', { userId: user.id });

    // Create user session
    const session: UserSession = {
      user,
      githubAccessToken: accessToken,
      permissions: [],
      belongsToOrg,
    };

    // Generate JWT
    logger.info('🔄 Generating JWT token...');
    const token = jwt.sign(session, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY as string | number,
    } as SignOptions);
    logger.info('✅ JWT token generated for VS Code extension');

    logger.info('✅ VS Code authentication successful', {
      userId: user.id,
      githubUsername: user.login,
    });

    // Return JSON response for VS Code extension
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          githubId: user.githubId,
          githubUsername: user.login,
        },
      },
    });
  } catch (error) {
    logger.error('❌ GitHub OAuth callback (POST) failed', { error });
    res.status(500).json({
      success: false,
      error: {
        error: 'InternalServerError',
        message: error instanceof Error ? error.message : 'Authentication failed',
        statusCode: 500,
      },
    });
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
 * Generate Personal Access Token (for VS Code extension)
 * POST /auth/generate-token
 * Requires user to be authenticated via web session
 */
router.post('/generate-token', authenticateToken, async (req: AuthRequest, res) => {
  try {
    logger.info('Generating personal access token', { userId: req.user!.user.id });

    // Create a long-lived token (1 year expiration)
    const session: UserSession = {
      user: req.user!.user,
      githubAccessToken: req.user!.githubAccessToken,
      permissions: [],
      belongsToOrg: req.user!.belongsToOrg,
    };

    const token = jwt.sign(session, config.JWT_SECRET, {
      expiresIn: '365d', // 1 year
    } as SignOptions);

    logger.info('Personal access token generated', {
      userId: req.user!.user.id,
      expiresIn: '365d'
    });

    res.json({
      success: true,
      data: {
        token,
        expiresIn: '365 days',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to generate personal access token', { error });
    res.status(500).json({
      success: false,
      error: {
        error: 'InternalServerError',
        message: 'Failed to generate token',
        statusCode: 500,
      },
    });
  }
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
 * Token-based login (for VS Code extension browser)
 * GET /auth/token-login?token=xxx&redirect=/upload
 * Accepts a JWT token, validates it, sets cookie, and redirects to specified page
 */
router.get('/token-login', (req, res) => {
  try {
    const { token, redirect } = req.query;

    if (!token || typeof token !== 'string') {
      logger.error('Token-login: No token provided');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Authentication Error</h1>
          <p>No token provided</p>
        </body>
        </html>
      `);
    }

    // Verify the token
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as UserSession;

      logger.info('Token-login: Token verified successfully', {
        userId: decoded.user.id,
        githubUsername: decoded.user.login
      });

      // Set the cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      logger.info('Token-login: Cookie set, preparing redirect', {
        redirect: redirect || '/upload',
        cookieSet: true
      });

      // Return HTML page that redirects client-side
      // This works better with VS Code's simple browser
      const redirectUrl = typeof redirect === 'string' ? redirect : '/upload';
      const frontendUrl = config.FRONTEND_URL;
      const fullRedirectUrl = `${frontendUrl}${redirectUrl}`;

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authenticating...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            }
            .spinner {
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top: 4px solid white;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .success {
              color: #4caf50;
              font-size: 48px;
              margin-bottom: 20px;
            }
            .debug {
              margin-top: 20px;
              padding: 10px;
              background: rgba(0,0,0,0.2);
              border-radius: 8px;
              font-size: 12px;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Authentication Successful!</h1>
            <p id="status">Redirecting to CX DAM...</p>
            <div class="debug">
              <strong>Debug Info:</strong><br>
              User: ${decoded.user.login}<br>
              Cookie set: ✓<br>
              Redirect to: ${fullRedirectUrl}<br>
              <span id="cookie-check"></span>
            </div>
          </div>
          <script>
            // Store token in localStorage as backup (for VS Code browser compatibility)
            // The frontend auth store will pick this up
            const tokenData = {
              user: {
                id: '${decoded.user.id}',
                email: '${decoded.user.email || ''}',
                name: '${decoded.user.name || ''}',
                login: '${decoded.user.login}',
                githubId: '${decoded.user.githubId}',
                avatarUrl: '${decoded.user.avatarUrl || ''}'
              },
              token: '${token}',
              permissions: [],
              belongsToOrg: ${decoded.belongsToOrg}
            };

            try {
              localStorage.setItem('cx-dam-auth', JSON.stringify({
                state: {
                  user: tokenData.user,
                  permissions: tokenData.permissions,
                  belongsToOrg: tokenData.belongsToOrg,
                  hasCheckedAuth: true
                },
                version: 0
              }));
              console.log('Token stored in localStorage for VS Code compatibility');
              document.getElementById('cookie-check').textContent = 'Token: Stored in localStorage ✓';
            } catch (e) {
              console.error('Failed to store token in localStorage:', e);
              document.getElementById('cookie-check').textContent = 'Token: Failed to store ✗';
            }

            console.log('Token-login page loaded');
            console.log('Cookies:', document.cookie);
            console.log('Redirecting to:', '${fullRedirectUrl}');

            // Redirect after a short delay to show the user what's happening
            setTimeout(() => {
              document.getElementById('status').textContent = 'Redirecting now...';
              window.location.href = '${fullRedirectUrl}';
            }, 1500);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      logger.error('Token-login: Invalid token', { error });
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
              background: #f5f5f5;
            }
            .error { color: #d32f2f; }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 500px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Authentication Failed</h1>
            <p>Invalid or expired token</p>
            <p>Please authenticate again in VS Code.</p>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    logger.error('Token-login: Failed', { error });
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Server Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            text-align: center;
            background: #f5f5f5;
          }
          .error { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1 class="error">Server Error</h1>
        <p>Token login failed</p>
      </body>
      </html>
    `);
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
