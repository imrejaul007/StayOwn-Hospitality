import { Request, Response, NextFunction } import logger from './utils/logger';
import from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`SLOW: ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
    if (process.env.NODE_ENV === 'development') {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
}
