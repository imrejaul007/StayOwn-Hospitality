import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

/**
 * HOTEL-OTA-ARCH-001: Enhanced error handler
 * - Request ID tracking for error correlation
 * - Structured error logging
 * - Sanitized error responses (no internal details in production)
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = err instanceof AppError ? err.code : 'INTERNAL_ERROR';

  // Log the error with full context
  logger.error('Request error', {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    errorCode,
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    userId: (req as any).user?.userId || (req as any).user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send sanitized response
  if (err instanceof AppError) {
    res.status(statusCode).json({
      error: true,
      code: errorCode,
      message: err.message,
      details: err.details,
      requestId,
    });
    return;
  }

  // Unknown error - don't leak internal details in production
  res.status(500).json({
    error: true,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    requestId,
  });
}

/**
 * Async wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
