import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('auth');

export interface AuthenticatedRequest extends Request {
  internalServiceToken?: string;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing auth token', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing X-Internal-Token header'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Verify token
  if (config.security.internalToken && token !== config.security.internalToken) {
    logger.warn('Invalid auth token', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }

  req.internalServiceToken = token;
  next();
};

export default authMiddleware;
