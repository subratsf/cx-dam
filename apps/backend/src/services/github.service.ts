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

      const data = (await response.json()) as
        | { error: string; error_description: string }
        | { access_token: string };

      if ('error' in data) {
        throw new Error(`GitHub OAuth error: ${data.error_description}`);
      }

      return data.access_token;
    } catch (error) {
      logger.error('Failed to get GitHub access token', { error });
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
      logger.error('Failed to check org membership', { error });
      throw error;
    }
  }

  /**
   * Get user's repository permissions
   * Returns list of repos with their permission levels
   */
  async getUserRepoPermissions(username: string): Promise<GitHubRepoPermission[]> {
    try {
      const permissions: GitHubRepoPermission[] = [];
      let page = 1;
      const perPage = 100;

      // Get all repos the authenticated user has access to
      while (true) {
        const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          affiliation: 'organization_member,collaborator',
          visibility: 'all',
        });

        if (repos.length === 0) break;

        // Filter for the specific organization and get permissions
        for (const repo of repos) {
          // Only include repos from our target organization
          if (repo.owner.login.toLowerCase() === config.GITHUB_ORG.toLowerCase()) {
            try {
              // Get detailed permission level
              const { data: collab } = await this.octokit.repos.getCollaboratorPermissionLevel({
                owner: config.GITHUB_ORG,
                repo: repo.name,
                username,
              });

              const permission = this.mapGitHubPermission(collab.permission);
              permissions.push({
                repoFullName: repo.full_name,
                permission,
              });
            } catch (error) {
              // If we can't get permission details, use the repo.permissions object
              const permission = this.inferPermissionFromRepo(repo);
              if (permission) {
                permissions.push({
                  repoFullName: repo.full_name,
                  permission,
                });
              }
              logger.debug('Using inferred permission for repo', { repo: repo.name });
            }
          }
        }

        // If we got fewer than perPage results, we're done
        if (repos.length < perPage) break;
        page++;
      }

      logger.info(`Found ${permissions.length} repositories for user ${username} in org ${config.GITHUB_ORG}`);
      return permissions;
    } catch (error) {
      logger.error('Failed to get user repo permissions', { error });
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
