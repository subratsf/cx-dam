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
    console.log('[S3 Upload] Starting upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      urlPrefix: uploadUrl.substring(0, 50) + '...',
    });

    const startTime = Date.now();

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[S3 Upload] Failed', {
        fileName: file.name,
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        duration,
      });
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
    }

    console.log('[S3 Upload] Completed successfully', {
      fileName: file.name,
      status: response.status,
      statusText: response.statusText,
      duration,
      etag: response.headers.get('etag'),
    });
  },

  async confirmUpload(assetId: string): Promise<void> {
    console.log('[Upload Confirmation] Starting confirmation', { assetId });

    try {
      const response = await apiClient.post(`/assets/${assetId}/confirm`);
      const result = extractData(response);

      console.log('[Upload Confirmation] Confirmed successfully', {
        assetId,
        result,
      });

      return result;
    } catch (error: any) {
      console.error('[Upload Confirmation] Failed', {
        assetId,
        error: error.response?.data || error.message,
        status: error.response?.status,
      });
      throw error;
    }
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

  async cleanupOrphanedByName(name: string, workspace: string): Promise<{ cleaned: boolean }> {
    console.log('[Cleanup] Attempting to cleanup orphaned asset', { name, workspace });
    try {
      const response = await apiClient.post('/assets/cleanup-by-name', { name, workspace });
      const result = extractData(response);
      console.log('[Cleanup] Cleanup result', result);
      return result;
    } catch (error: any) {
      console.error('[Cleanup] Failed to cleanup orphaned asset', {
        name,
        workspace,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  },
};
