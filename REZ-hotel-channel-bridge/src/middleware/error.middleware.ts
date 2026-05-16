import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('errorHandler');

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  logger.error('Request error', {
    path: req.path,
    method: req.method,
    statusCode,
    code,
    message,
    stack: err.stack,
    details: err.details
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details && { details: err.details })
    },
    timestamp: new Date().toISOString()
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    timestamp: new Date().toISOString()
  });
};

export const zodErrorHandler = (err: ZodError, res: Response): void => {
  const details = err.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message
  }));

  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details
    },
    timestamp: new Date().toISOString()
  });
};

export default errorHandler;
