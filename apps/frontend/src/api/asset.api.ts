import {
  Asset,
  CreateAssetInput,
  UpdateAssetInput,
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

  async semanticSearch(
    query: string,
    limit: number = 20
  ): Promise<PaginatedResponse<Asset & { downloadUrl: string; searchScore?: number }>> {
    const response = await apiClient.get('/assets/search/semantic', { params: { q: query, limit } });
    return extractData(response);
  },

  async getById(id: string): Promise<Asset & { downloadUrl: string }> {
    const response = await apiClient.get(`/assets/${id}`);
    return extractData(response);
  },

  async updateAsset(id: string, input: UpdateAssetInput): Promise<Asset & { downloadUrl: string }> {
    const response = await apiClient.patch(`/assets/${id}`, input);
    return extractData(response);
  },

  async replaceAsset(id: string, file: File): Promise<Asset & { downloadUrl: string }> {
    console.log('[Replace Asset] Starting replacement', {
      assetId: id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // Step 1: Request presigned URL for replace
    const replaceUrlResponse = await apiClient.put(`/assets/${id}/replace`, {
      mimeType: file.type,
      size: file.size,
    });
    const { uploadUrl, assetId, s3Key } = extractData(replaceUrlResponse);

    console.log('[Replace Asset] Got presigned URL', {
      assetId,
      s3Key,
    });

    // Step 2: Upload file to S3
    await this.uploadToS3(uploadUrl, file);

    // Step 3: Confirm replacement
    console.log('[Replace Asset] Confirming replacement', { assetId });
    await apiClient.post(`/assets/${assetId}/confirm-replace`, {
      s3Key,
      mimeType: file.type,
      size: file.size,
    });

    console.log('[Replace Asset] Replacement confirmed', { assetId });

    // Step 4: Get updated asset info
    return this.getById(assetId);
  },

  async deleteAsset(id: string): Promise<void> {
    await apiClient.delete(`/assets/${id}`);
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
