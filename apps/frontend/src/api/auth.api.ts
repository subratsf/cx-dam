import { User, GitHubRepoPermission } from '@cx-dam/shared';
import { apiClient, extractData } from './client';

export interface UserSession {
  user: User;
  permissions: GitHubRepoPermission[];
  belongsToOrg: boolean;
}

export const authApi = {
  async getMe(): Promise<UserSession> {
    const response = await apiClient.get('/auth/me');
    return extractData(response);
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  getLoginUrl(): string {
    return '/api/auth/github';
  },
};
