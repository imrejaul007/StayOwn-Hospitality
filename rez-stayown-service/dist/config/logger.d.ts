/**
 * Logger Configuration
 *
 * Simple structured logging for the StayOwn service.
 * Uses console.log in development and can be extended for production
 * (e.g., Winston, Pino, or cloud logging).
 */
interface LogContext {
    [key: string]: unknown;
}
declare class Logger {
    private isDevelopment;
    constructor();
    private formatMessage;
    private shouldLog;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    logRequest(req: {
        method: string;
        path: string;
        ip?: string;
        userAgent?: string;
    }, res: {
        statusCode: number;
    }, durationMs?: number): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map