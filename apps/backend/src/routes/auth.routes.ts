import { Router } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserSession } from '@cx-dam/shared';
import { config } from '../config';
import { logger } from '../utils/logger';
import { GitHubService } from '../services/github.service';
import { userRepository } from '../repositories/user.repository';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';

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

    // Get repository permissions
    const permissions = await authenticatedGithubService.getUserRepoPermissions(githubUser.login);

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
    });

    res.redirect(`${config.FRONTEND_URL}?auth=success`);
  } catch (error) {
    logger.error('GitHub OAuth callback failed', { error });
    res.redirect(`${config.FRONTEND_URL}?auth=failed`);
  }
});

/**
 * Get current user session
 * GET /auth/me
 */
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  res.json({
    success: true,
    data: {
      user: req.user!.user,
      permissions: req.user!.permissions,
      belongsToOrg: req.user!.belongsToOrg,
    },
  });
});

/**
 * Logout
 * POST /auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

export default router;
