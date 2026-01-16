import { User, GitHubRepoPermission } from '@cx-dam/shared';
import { apiClient, extractData } from './client';

export interface UserSession {
  user: User;
  permissions: GitHubRepoPermission[];
  belongsToOrg: boolean;
}

export interface PersonalAccessToken {
  token: string;
  expiresIn: string;
  createdAt: string;
}

export const authApi = {
  async getMe(): Promise<UserSession> {
    const response = await apiClient.get('/auth/me');
    return extractData(response);
  },

  async refreshPermissions(): Promise<{ permissions: GitHubRepoPermission[]; count: number }> {
    const response = await apiClient.get('/auth/refresh-permissions');
    return extractData(response);
  },

  async generateToken(): Promise<PersonalAccessToken> {
    const response = await apiClient.post('/auth/generate-token');
    return extractData(response);
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  getLoginUrl(): string {
    return '/api/auth/github';
  },
};
