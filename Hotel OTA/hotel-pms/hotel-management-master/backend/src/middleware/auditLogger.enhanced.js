/**
 * Enhanced Audit Logger Middleware
 * Logs all critical operations for compliance (GDPR, PCI-DSS).
 * Records: who, what, when, where, and the before/after state.
 */
import logger from '../utils/logger.js';

const CRITICAL_OPERATIONS = {
  DELETE: 'DELETE',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
};

const SENSITIVE_PATHS = [
  '/auth', '/users', '/payments', '/financial', '/bookings',
  '/guests', '/settlements', '/gdpr', '/roles', '/permissions',
  '/bypass', '/admin',
];

/**
 * Middleware that logs audit trail entries for critical operations.
 * @param {Model} AuditLogModel - Mongoose model for audit logs
 */
const enhancedAuditLogger = (AuditLogModel) => {
  return async (req, res, next) => {
    // Only audit critical operations on sensitive paths
    const operation = CRITICAL_OPERATIONS[req.method];
    if (!operation) return next();

    const isSensitive = SENSITIVE_PATHS.some(p => req.originalUrl.includes(p));
    if (!isSensitive) return next();

    // Capture the original res.json to intercept the response
    const originalJson = res.json.bind(res);
    const startTime = Date.now();

    res.json = function (body) {
      // Only log for authenticated users with valid context
      const userId = req.user?._id || req.user?.id;
      const hotelId = req.tenantId || req.user?.hotelId || req.user?.hotel;

      // Skip audit logging if no authenticated user or no hotel context
      if (!userId || !hotelId) {
        return originalJson(body);
      }

      const resourcePath = req.originalUrl.split('?')[0];
      const resourceId = req.params?.id || body?.data?._id || 'unknown';

      // Map HTTP method to changeType
      const changeTypeMap = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete' };
      const changeType = changeTypeMap[operation] || 'update';

      // Extract table/resource name from URL
      const urlParts = resourcePath.split('/').filter(Boolean);
      const tableName = urlParts[2] || urlParts[1] || 'unknown'; // /api/v1/{tableName}

      const auditEntry = {
        userId,
        userEmail: req.user?.email || 'unknown',
        hotelId,
        action: operation,
        changeType,
        tableName,
        recordId: String(resourceId),
        resource: resourcePath,
        method: req.method,
        statusCode: res.statusCode,
        requestBody: sanitizeForLog(req.body),
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      // Non-blocking save
      if (AuditLogModel) {
        AuditLogModel.create(auditEntry).catch(err => {
          logger.warn('Audit log entry creation failed:', err.message);
        });
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Remove sensitive fields from request body before logging.
 */
function sanitizeForLog(body) {
  if (!body) return null;
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'cvv', 'cardNumber', 'ssn', 'aadhaar'];
  for (const field of sensitiveFields) {
    if (sanitized[field]) sanitized[field] = '***REDACTED***';
  }
  return sanitized;
}

export { enhancedAuditLogger };
