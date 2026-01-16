import axios, { AxiosInstance, AxiosError } from 'axios';

export interface Asset {
  id: string;
  name: string;
  workspace: string;
  s3Key: string;
  fileType: string;
  fileSize: number;
  state: 'Stage' | 'Prod';
  uploadedBy: string;
  uploadedAt: string;
  tags: string[];
  aiDescription?: string;
  downloadUrl?: string;
  searchScore?: number;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      githubId: string;
      githubUsername: string;
    };
  };
}

export interface AssetsResponse {
  success: boolean;
  data: {
    data: Asset[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface Workspace {
  repoFullName: string;
  permission: string;
}

export class CxDamClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  getToken(): string | null {
    return this.token;
  }

  async getGitHubAuthUrl(): Promise<string> {
    const response = await this.client.get<{ url: string }>('/auth/github/url');
    return response.data.url;
  }

  async exchangeCodeForToken(code: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/github/callback', {
      code,
    });
    if (response.data.success && response.data.data.token) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const response = await this.client.get<{
      success: boolean;
      data: { permissions: Workspace[] };
    }>('/auth/me');
    return response.data.data.permissions;
  }

  async searchAssets(params: {
    q?: string;
    workspace?: string;
    fileType?: string;
    tags?: string;
    page?: number;
    limit?: number;
  }): Promise<AssetsResponse> {
    const response = await this.client.get<AssetsResponse>('/assets/search', {
      params,
    });
    return response.data;
  }

  async semanticSearch(query: string, limit: number = 20): Promise<AssetsResponse> {
    const response = await this.client.get<AssetsResponse>('/assets/search/semantic', {
      params: { q: query, limit },
    });
    return response.data;
  }

  async getAssetById(id: string): Promise<Asset | null> {
    try {
      const response = await this.client.get<{ success: boolean; data: Asset }>(
        `/assets/${id}`
      );
      return response.data.data;
    } catch (error) {
      return null;
    }
  }

  async uploadAsset(formData: FormData): Promise<{
    success: boolean;
    data: { asset: Asset; uploadUrl: string };
  }> {
    const response = await this.client.post('/assets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async confirmUpload(assetId: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/assets/${assetId}/confirm`);
    return response.data;
  }

  async deleteAsset(assetId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/assets/${assetId}`);
    return response.data;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  handleError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response) {
        return axiosError.response.data?.message || `Error: ${axiosError.response.status}`;
      } else if (axiosError.request) {
        return 'Network error: Unable to reach CX DAM server';
      }
    }
    return error instanceof Error ? error.message : 'Unknown error occurred';
  }
}
