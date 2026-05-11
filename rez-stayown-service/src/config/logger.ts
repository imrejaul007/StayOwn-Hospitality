/**
 * Logger Configuration
 *
 * Simple structured logging for the StayOwn service.
 * Uses console.log in development and can be extended for production
 * (e.g., Winston, Pino, or cloud logging).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;

    // In production, log info and above
    return level !== 'debug';
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  // Grouped logging for API requests
  logRequest(req: {
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
  }, res: {
    statusCode: number;
  }, durationMs?: number): void {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.ip,
      durationMs,
    });
  }
}

// Export singleton instance
export const logger = new Logger();
