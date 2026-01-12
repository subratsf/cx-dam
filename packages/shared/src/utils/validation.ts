import { z } from 'zod';
import { ApiError } from '../types/api.types';

export class ValidationError extends Error {
  public statusCode = 400;
  public details: z.ZodError;

  constructor(zodError: z.ZodError) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.details = zodError;
  }

  toApiError(): ApiError {
    return {
      error: 'ValidationError',
      message: 'Validation failed',
      statusCode: this.statusCode,
      details: this.details.errors,
    };
  }
}

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
}

export function isValidWorkspace(workspace: string): boolean {
  // Validate GitHub repo format: org/repo
  const githubRepoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;
  return githubRepoRegex.test(workspace);
}

export function sanitizeFileName(fileName: string): string {
  // Remove special characters, keep alphanumeric, dots, hyphens, underscores
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getAssetTypeFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar'))
    return 'archive';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('doc') ||
    mimeType.includes('text')
  )
    return 'document';
  return 'other';
}
