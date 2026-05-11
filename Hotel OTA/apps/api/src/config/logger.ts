import { env } from './env';
import { randomUUID } from 'crypto';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * HOTEL-OTA-ARCH-001: Enhanced structured logging
 * - JSON format in production for log aggregation
 * - Request ID tracking for distributed tracing
 * - Consistent log structure across all services
 */
function format(level: LogLevel, service: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();

  if (env.NODE_ENV === 'production') {
    // Structured JSON logging for production (Datadog, CloudWatch, etc.)
    const entry: LogEntry = {
      timestamp: ts,
      level,
      service,
      message,
      ...meta,
    };
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level.toUpperCase()}] [${service}] ${message}${metaStr}`;
}

function makeLogger(service: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => {
      console.log(format('info', service, message, meta));
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      console.warn(format('warn', service, message, meta));
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      console.error(format('error', service, message, meta));
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (env.NODE_ENV !== 'production') {
        console.debug(format('debug', service, message, meta));
      }
    },
  };
}

/** Default named export for files that do `import { logger }` */
export const logger = makeLogger('app');

/** Factory for files that do `createServiceLogger('my-service')` */
export function createServiceLogger(service: string) {
  return makeLogger(service);
}

/**
 * Generate or extract request ID for tracing
 * Checks x-request-id header first, generates if not present
 */
export function getRequestId(headers: Record<string, string | string[] | undefined>): string {
  const headerId = headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) {
    return headerId;
  }
  return randomUUID();
}
