import { z } from 'zod';

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  details: z.any().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: ApiError;
};
