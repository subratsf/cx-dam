import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserSession } from '@cx-dam/shared';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: UserSession;
}

/**
 * Middleware to verify JWT token and attach user session to request
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          error: 'Unauthorized',
          message: 'No authentication token provided',
          statusCode: 401,
        },
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as UserSession;
    req.user = decoded;

    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    return res.status(401).json({
      success: false,
      error: {
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        statusCode: 401,
      },
    });
  }
}

/**
 * Middleware to make authentication optional
 * Attaches user if token is present and valid, but doesn't reject if missing
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.token;

    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET) as UserSession;
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Invalid token, but we continue without user
    logger.debug('Optional auth failed, continuing without user', { error });
    next();
  }
}
