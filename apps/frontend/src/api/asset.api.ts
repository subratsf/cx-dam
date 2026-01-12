import {
  Asset,
  CreateAssetInput,
  SearchAssetsQuery,
  PresignedUrlResponse,
  PaginatedResponse,
} from '@cx-dam/shared';
import { apiClient, extractData } from './client';

export const assetApi = {
  async requestUploadUrl(
    input: CreateAssetInput
  ): Promise<PresignedUrlResponse> {
    const response = await apiClient.post('/assets/upload-url', input);
    return extractData(response);
  },

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
  },

  async validateName(name: string, workspace: string): Promise<{ isUnique: boolean }> {
    const response = await apiClient.get('/assets/validate-name', {
      params: { name, workspace },
    });
    return extractData(response);
  },

  async search(
    query: SearchAssetsQuery
  ): Promise<PaginatedResponse<Asset & { downloadUrl: string }>> {
    const response = await apiClient.get('/assets/search', { params: query });
    return extractData(response);
  },

  async getById(id: string): Promise<Asset & { downloadUrl: string }> {
    const response = await apiClient.get(`/assets/${id}`);
    return extractData(response);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/assets/${id}`);
  },
};
