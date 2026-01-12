import { z } from 'zod';

export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
  ARCHIVE = 'archive',
  DOCUMENT = 'document',
  OTHER = 'other',
}

export const AssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  workspace: z.string(), // GitHub repo name (e.g., "salesforcedocs/documentation")
  tags: z.array(z.string()),
  fileType: z.nativeEnum(AssetType),
  mimeType: z.string(),
  size: z.number().positive(),
  s3Key: z.string(),
  s3Bucket: z.string(),
  uploadedBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(255),
  workspace: z.string().min(1),
  tags: z.array(z.string()).default([]),
  mimeType: z.string(),
  size: z.number().positive(),
});

export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;

export const SearchAssetsQuerySchema = z.object({
  q: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  workspace: z.string().optional(),
  fileType: z.nativeEnum(AssetType).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type SearchAssetsQuery = z.infer<typeof SearchAssetsQuerySchema>;

export const PresignedUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  assetId: z.string().uuid(),
  s3Key: z.string(),
});

export type PresignedUrlResponse = z.infer<typeof PresignedUrlResponseSchema>;

export const ValidateNameQuerySchema = z.object({
  name: z.string().min(1),
  workspace: z.string().min(1),
});

export type ValidateNameQuery = z.infer<typeof ValidateNameQuerySchema>;
