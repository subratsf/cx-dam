import { Octokit } from '@octokit/rest';
import { GitHubUser, GitHubRepoPermission, PermissionLevel } from '@cx-dam/shared';
import { config } from '../config';
import { logger } from '../utils/logger';

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken?: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<string> {
    try {
      logger.info('Exchanging authorization code for access token', {
        code: code.substring(0, 10) + '...',
        clientId: config.GITHUB_CLIENT_ID,
        hasClientSecret: !!config.GITHUB_CLIENT_SECRET,
      });

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: config.GITHUB_CLIENT_ID,
          client_secret: config.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      logger.info('GitHub OAuth response received', {
        status: response.status,
        statusText: response.statusText,
      });

      const data = (await response.json()) as
        | { error: string; error_description: string; error_uri?: string }
        | { access_token: string };

      logger.info('GitHub OAuth response data', {
        hasError: 'error' in data,
        hasAccessToken: 'access_token' in data,
        data: 'error' in data ? data : { access_token: '***' }
      });

      if ('error' in data) {
        const errorMsg = `GitHub OAuth error: ${data.error} - ${data.error_description}`;
        logger.error(errorMsg, { error: data.error, description: data.error_description });
        throw new Error(errorMsg);
      }

      if (!data.access_token) {
        throw new Error('No access token received from GitHub');
      }

      return data.access_token;
    } catch (error) {
      logger.error('Failed to get GitHub access token', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
      };
    } catch (error) {
      logger.error('Failed to get authenticated user', { error });
      throw error;
    }
  }

  /**
   * Check if user belongs to the required organization
   */
  async checkOrgMembership(username: string): Promise<boolean> {
    try {
      await this.octokit.orgs.checkMembershipForUser({
        org: config.GITHUB_ORG,
        username,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      // Handle 403 errors (IP allow list restrictions) gracefully
      if (error.status === 403) {
        logger.warn('Org membership check blocked by IP allow list, assuming true based on repo access', {
          username,
          org: config.GITHUB_ORG,
          error: error.message,
        });
        // Return true - we'll rely on repo permissions for actual access control
        return true;
      }
      logger.error('Failed to check org membership', { error });
      throw error;
    }
  }

  /**
   * Get user's repository permissions
   * Returns list of repos with their permission levels
   * Optimized to reduce API calls by inferring permissions from repo object
   */
  async getUserRepoPermissions(username: string): Promise<GitHubRepoPermission[]> {
    try {
      const permissions: GitHubRepoPermission[] = [];
      let page = 1;
      const perPage = 100;
      let totalRepos = 0;

      logger.info(`Starting to fetch repositories for user ${username}...`);

      // Get all repos the authenticated user has access to
      while (true) {
        logger.info(`📥 Fetching page ${page} (up to ${perPage} repos per page)...`);

        const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          affiliation: 'organization_member,collaborator',
          visibility: 'all',
        });

        if (repos.length === 0) break;

        logger.info(`✓ Received ${repos.length} repositories from page ${page}`);

        // Filter for the specific organization and get permissions
        const orgRepos = repos.filter(
          repo => repo.owner.login.toLowerCase() === config.GITHUB_ORG.toLowerCase()
        );

        logger.info(`📊 Found ${orgRepos.length} repositories from ${config.GITHUB_ORG} on this page`);

        for (const repo of orgRepos) {
          // Use inferred permissions first (much faster, no additional API call)
          const permission = this.inferPermissionFromRepo(repo);
          if (permission) {
            permissions.push({
              repoFullName: repo.full_name,
              permission,
            });
            totalRepos++;
          } else {
            // Fallback: Get detailed permission level (slower)
            try {
              const { data: collab } = await this.octokit.repos.getCollaboratorPermissionLevel({
                owner: config.GITHUB_ORG,
                repo: repo.name,
                username,
              });

              const mappedPermission = this.mapGitHubPermission(collab.permission);
              permissions.push({
                repoFullName: repo.full_name,
                permission: mappedPermission,
              });
              totalRepos++;
            } catch (error) {
              logger.warn('Failed to get permission for repo, skipping', {
                repo: repo.name,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }

        logger.info(`✅ Processed ${totalRepos} repositories so far...`);

        // If we got fewer than perPage results, we're done
        if (repos.length < perPage) break;
        page++;
      }

      logger.info(`🎉 Completed! Found ${permissions.length} repositories for user ${username} in org ${config.GITHUB_ORG}`);
      return permissions;
    } catch (error) {
      logger.error('❌ Failed to get user repo permissions', { error });
      throw error;
    }
  }

  /**
   * Infer permission level from repository object
   */
  private inferPermissionFromRepo(repo: any): PermissionLevel | null {
    if (!repo.permissions) return null;

    if (repo.permissions.admin) {
      return PermissionLevel.ADMIN;
    } else if (repo.permissions.maintain) {
      return PermissionLevel.MAINTAINER;
    } else if (repo.permissions.push) {
      return PermissionLevel.CONTRIBUTOR;
    } else if (repo.permissions.pull) {
      return PermissionLevel.VIEWER;
    }

    return null;
  }

  /**
   * Get user's permission for a specific repository
   */
  async getRepoPermission(username: string, repoFullName: string): Promise<PermissionLevel> {
    try {
      const [owner, repo] = repoFullName.split('/');

      const { data: collab } = await this.octokit.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      });

      return this.mapGitHubPermission(collab.permission);
    } catch (error: any) {
      if (error.status === 404) {
        return PermissionLevel.VIEWER;
      }
      logger.error('Failed to get repo permission', { error });
      throw error;
    }
  }

  /**
   * Map GitHub permission strings to our PermissionLevel enum
   */
  private mapGitHubPermission(githubPermission: string): PermissionLevel {
    switch (githubPermission) {
      case 'admin':
        return PermissionLevel.ADMIN;
      case 'maintain':
        return PermissionLevel.MAINTAINER;
      case 'write':
      case 'push':
        return PermissionLevel.CONTRIBUTOR;
      case 'read':
      case 'pull':
      default:
        return PermissionLevel.VIEWER;
    }
  }
}
