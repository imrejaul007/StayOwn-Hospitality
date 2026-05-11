"use strict";
/**
 * Logger Configuration
 *
 * Simple structured logging for the StayOwn service.
 * Uses console.log in development and can be extended for production
 * (e.g., Winston, Pino, or cloud logging).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    isDevelopment;
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }
    shouldLog(level) {
        if (this.isDevelopment)
            return true;
        // In production, log info and above
        return level !== 'debug';
    }
    debug(message, context) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, context));
        }
    }
    info(message, context) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, context));
        }
    }
    warn(message, context) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, context));
        }
    }
    error(message, context) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, context));
        }
    }
    // Grouped logging for API requests
    logRequest(req, res, durationMs) {
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
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map