import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers so errors are caught and passed to Express error handler.
 * Without this, unhandled promise rejections crash the server.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
