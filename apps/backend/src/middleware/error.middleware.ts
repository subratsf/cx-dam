import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@cx-dam/shared';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Request error', {
    error: err,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // Handle validation errors
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: err.toApiError(),
    });
  }

  // Handle app errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        error: err.name,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
      },
    });
  }

  // Handle unexpected errors
  return res.status(500).json({
    success: false,
    error: {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      statusCode: 500,
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      error: 'NotFound',
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
    },
  });
}
