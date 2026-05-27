// Sentry Error Tracking Configuration
// Habixo - Smart Living OS powered by ReZ

import * as Sentry from '@sentry/node';
import { NodeClient } from '@sentry/node';
import { RewriteFrames } from '@sentry/remix';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

// Sentry Data Source Name (get from Sentry dashboard)
const SENTRY_DSN = process.env.SENTRY_DSN;

// Service identification
const SERVICE_NAME = 'habixo-service';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';

// Initialize Sentry if DSN is provided
export function initSentry(): NodeClient | null {
  if (!SENTRY_DSN) {
    logger.warn('Sentry DSN not configured. Error tracking disabled.');
    return null;
  }

  const client = Sentry.init({
    dsn: SENTRY_DSN,
    environment: config.nodeEnv,
    release: `${SERVICE_NAME}@${SERVICE_VERSION}`,
    sampleRate: 1,
    maxBreadcrumbs: 50,
    attachStacktrace: true,

    // Performance monitoring
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,

    // Filter out noisy errors
    ignoreErrors: [
      'Non-Error promise rejection captured with keys: message',
      'ResizeObserver loop completed with iterations',
    ],

    // Integrations
    integrations: (integrations) => [
      ...integrations,
      // Rewrite frames for better stack traces
      new RewriteFrames({
        root: process.cwd(),
      }),
      // HTTP integration for request tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Express integration for middleware tracing
      new Sentry.Integrations.Express({
        router: undefined, // Will be set manually
      }),
    ],

    // Before send hook for filtering/modifying events
    beforeSend: (event) => {
      // Remove sensitive data from error messages
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((exc) => {
          // Filter out sensitive patterns from error messages
          if (exc.value) {
            exc.value = exc.value
              .replace(/password[=:]\s*\S+/gi, 'password=***')
              .replace(/token[=:]\s*\S+/gi, 'token=***')
              .replace(/Authorization[=:]\s*\S+/gi, 'Authorization=***');
          }
          return exc;
        });
      }
      return event;
    },
  });

  logger.info('Sentry initialized successfully');
  return client;
}

// Request context middleware - adds request info to Sentry scope
export function addRequestContext(req: Request): void {
  Sentry.setContext('request', {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.get('user-agent'),
      'content-type': req.get('content-type'),
      'x-forwarded-for': req.get('x-forwarded-for'),
    },
    ip: req.ip || req.connection?.remoteAddress,
    body: sanitizeBody(req.body),
  });
}

// User context middleware - adds authenticated user info to Sentry scope
export function addUserContext(user?: { id: string; email?: string; role?: string }): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      // Don't include username to avoid PII issues
    });
    Sentry.setContext('user', {
      role: user.role || 'unknown',
    });
  }
}

// Sanitize request body to remove sensitive fields
function sanitizeBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'authorization',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'creditCard',
    'credit_card',
    'cvv',
    'ssn',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Express error handler middleware
export function sentryErrorHandler(
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Add request context
  addRequestContext(req);

  // Extract user from request if available (depends on auth middleware)
  const user = (req as Request & { user?: { id: string; email?: string; role?: string } }).user;
  if (user) {
    addUserContext(user);
  }

  // Capture the error
  Sentry.captureException(err, {
    extra: {
      path: req.path,
      method: req.method,
    },
  });

  // Log locally as well
  logger.error({
    error: err,
    path: req.path,
    method: req.method,
  }, 'Sentry captured error');

  next(err);
}

// Request handler middleware - wraps request handlers with Sentry tracing
export function sentryRequestHandler(): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return Sentry.Handlers.requestHandler({
    // Include request body
    body: true,
    // Include user IP
    ip: true,
    // Include cookies
    cookies: false,
    // Include headers (sanitized)
    headers: true,
  }) as (req: Request, res: Response, next: NextFunction) => void;
}

// Tracing handler for performance monitoring
export function sentryTracingHandler(): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return Sentry.Handlers.tracingHandler() as (req: Request, res: Response, next: NextFunction) => void;
}

// Flush Sentry and exit (for graceful shutdown)
export async function flushSentry(timeoutMs: number = 2000): Promise<void> {
  try {
    await Sentry.flush(timeoutMs);
    logger.info('Sentry flushed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to flush Sentry');
  }
}

// Export Sentry for direct use
export { Sentry };
