import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { config } from '../config';

interface ModerationResult {
  is_safe: boolean;
  message: string;
  detections: Array<{
    label: string;
    confidence: number;
    box?: any;
  }>;
  confidence_scores: Record<string, number>;
}

interface AnalysisResult {
  is_safe: boolean;
  description: string | null;
  embedding: number[] | null;
  moderation_details: ModerationResult;
}

interface SearchResult {
  asset_id: string;
  score: number;
  description: string;
  workspace: string;
  name: string;
}

class ImageAnalysisService {
  private client: AxiosInstance;
  private isAvailable: boolean = false;
  private serviceUrl: string;

  constructor() {
    this.serviceUrl = process.env.IMAGE_ANALYSIS_SERVICE_URL || 'http://localhost:8001';

    this.client = axios.create({
      baseURL: this.serviceUrl,
      timeout: 60000, // 60 seconds for image processing
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Check availability on initialization
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      this.isAvailable = response.data.status === 'healthy';

      logger.info('Image analysis service status', {
        available: this.isAvailable,
        services: response.data.services,
      });
    } catch (error) {
      this.isAvailable = false;
      logger.warn('Image analysis service not available', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceUrl: this.serviceUrl,
      });
    }
  }

  public async isServiceAvailable(): Promise<boolean> {
    if (!this.isAvailable) {
      await this.checkAvailability();
    }
    return this.isAvailable;
  }

  /**
   * Check if image is safe (content moderation)
   */
  async moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      });

      logger.info('Starting image moderation');

      const response = await this.client.post('/api/moderate', formData, {
        headers: formData.getHeaders(),
      });

      const result: ModerationResult = {
        is_safe: response.data.is_safe,
        message: response.data.message,
        detections: response.data.details?.detections || [],
        confidence_scores: response.data.details?.confidence_scores || {},
      };

      logger.info('Image moderation complete', {
        is_safe: result.is_safe,
        detections_count: result.detections.length,
      });

      return result;
    } catch (error) {
      logger.error('Image moderation failed', { error });

      // Default to safe if service is unavailable (fail open for demo)
      // In production, you might want to fail closed (reject on error)
      return {
        is_safe: true,
        message: 'Moderation service unavailable - defaulting to safe',
        detections: [],
        confidence_scores: {},
      };
    }
  }

  /**
   * Full analysis: moderation + description + embeddings
   */
  async analyzeImage(imageBuffer: Buffer): Promise<AnalysisResult> {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      });

      logger.info('Starting full image analysis');

      const response = await this.client.post('/api/analyze', formData, {
        headers: formData.getHeaders(),
      });

      const result: AnalysisResult = {
        is_safe: response.data.is_safe,
        description: response.data.description,
        embedding: response.data.embedding,
        moderation_details: response.data.moderation_details,
      };

      logger.info('Image analysis complete', {
        is_safe: result.is_safe,
        has_description: !!result.description,
        has_embedding: !!result.embedding,
      });

      return result;
    } catch (error) {
      logger.error('Image analysis failed', { error });

      // Return safe with no description on error
      return {
        is_safe: true,
        description: null,
        embedding: null,
        moderation_details: {
          is_safe: true,
          message: 'Analysis service unavailable',
          detections: [],
          confidence_scores: {},
        },
      };
    }
  }

  /**
   * Generate description only
   */
  async describeImage(imageBuffer: Buffer): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      });

      logger.info('Generating image description');

      const response = await this.client.post('/api/describe', formData, {
        headers: formData.getHeaders(),
      });

      return response.data.description;
    } catch (error) {
      logger.error('Image description failed', { error });
      return null;
    }
  }

  /**
   * Search for similar images using text query
   */
  async searchSemantic(query: string, limit: number = 20): Promise<SearchResult[]> {
    try {
      logger.info('Semantic search', { query, limit });

      const response = await this.client.post(
        '/api/search',
        { query, limit },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const results: SearchResult[] = response.data;

      logger.info('Semantic search complete', {
        query,
        results_count: results.length,
      });

      return results;
    } catch (error) {
      logger.error('Semantic search failed', { error });
      return [];
    }
  }

  /**
   * Index an asset in the vector database
   */
  async indexAsset(
    assetId: string,
    description: string,
    workspace: string,
    name: string
  ): Promise<boolean> {
    try {
      logger.info('Indexing asset', { assetId, workspace, name });

      await this.client.post(
        '/api/index',
        {
          asset_id: assetId,
          description,
          workspace,
          name,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      logger.info('Asset indexed successfully', { assetId });
      return true;
    } catch (error) {
      logger.error('Asset indexing failed', { assetId, error });
      return false;
    }
  }
}

export const imageAnalysisService = new ImageAnalysisService();
