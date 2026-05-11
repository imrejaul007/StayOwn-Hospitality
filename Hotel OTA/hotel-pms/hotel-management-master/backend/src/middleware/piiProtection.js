import logger from '../utils/logger.js';

/**
 * PII Protection Middleware
 *
 * Provides middleware functions for handling Personally Identifiable Information (PII)
 * in compliance with GDPR and data protection regulations.
 *
 * - Strips PII from responses for unauthorized roles
 * - Masks sensitive fields (email, phone, passport, etc.)
 * - Logs PII access for audit purposes
 * - Prevents PII leakage in error responses
 */

// Fields classified as PII
const PII_FIELDS = [
  'email', 'phone', 'passport', 'nationalId', 'ssn',
  'dateOfBirth', 'address', 'postalCode', 'emergencyContact',
  'creditCardNumber', 'bankAccountNumber', 'iban',
  'driverLicense', 'taxId', 'ipAddress'
];

// Fields that should be masked (partially visible) rather than removed
const MASKABLE_FIELDS = ['email', 'phone', 'passport', 'nationalId', 'creditCardNumber'];

// Roles allowed to view full PII in API responses.
// - admin/manager: full operational access for hotel management.
// - frontdesk: needs PII for check-in/check-out and guest service workflows.
// SECURITY: 'staff' is intentionally NOT included. Staff see masked PII in list views.
// Individual service request controllers that legitimately need full PII (e.g., a
// staff member viewing their own assigned guest request) must explicitly grant access
// through controller-level logic rather than blanket middleware bypass.
const PII_AUTHORIZED_ROLES = ['admin', 'manager', 'frontdesk'];

/**
 * Mask a PII value to show only partial information
 */
function maskValue(field, value) {
  if (!value || typeof value !== 'string') return '***';

  switch (field) {
    case 'email': {
      const [local, domain] = value.split('@');
      if (!domain) return '***@***';
      const maskedLocal = local.length > 2
        ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
        : '**';
      return `${maskedLocal}@${domain}`;
    }
    case 'phone':
      return value.length > 4
        ? '*'.repeat(value.length - 4) + value.slice(-4)
        : '****';
    case 'passport':
    case 'nationalId':
    case 'driverLicense':
      return value.length > 4
        ? '*'.repeat(value.length - 4) + value.slice(-4)
        : '****';
    case 'creditCardNumber':
      return '*'.repeat(12) + value.slice(-4);
    default:
      return '***';
  }
}

/**
 * Only recurse into plain records created via `{}` / JSON. Dates, ObjectIds, Buffers,
 * Decimal128, etc. must not be walked: Object.entries(Date) is empty and would replace
 * the value with `{}`, breaking booking checkIn/checkOut/createdAt in guest responses.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively mask PII fields in an object.
 * Tracks visited objects to avoid infinite recursion on circular references.
 */
function maskPIIInObject(obj, mask = true, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (obj instanceof Date) {
    return obj;
  }

  // Prevent infinite recursion on circular references
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => maskPIIInObject(item, mask, seen));
  }

  if (!isPlainObject(obj)) {
    if (typeof obj.toHexString === 'function') {
      return obj.toHexString();
    }
    return obj;
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key)) {
      if (mask) {
        result[key] = MASKABLE_FIELDS.includes(key) ? maskValue(key, value) : '[REDACTED]';
      } else {
        result[key] = value;
      }
    } else if (value && typeof value === 'object') {
      result[key] = maskPIIInObject(value, mask, seen);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Middleware: Mask PII in responses for unauthorized roles
 *
 * Intercepts res.json() to automatically mask PII fields
 * when the requesting user does not have an authorized role.
 */
export function piiResponseFilter(req, res, next) {
  const userRole = req.user?.role;
  const isAuthorized = PII_AUTHORIZED_ROLES.includes(userRole);

  // Only intercept if user is not authorized to view PII
  if (!isAuthorized) {
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      if (body && typeof body === 'object') {
        const filtered = maskPIIInObject(body, true);
        return originalJson(filtered);
      }
      return originalJson(body);
    };
  }

  next();
}

/**
 * Middleware: Log PII access for audit trail
 *
 * Records when PII data is accessed, who accessed it, and from where.
 * This is required for GDPR compliance (Article 30 - Records of Processing Activities).
 */
/**
 * Check if an object (or its nested children) contains any PII field keys.
 * Uses a shallow walk (max depth 6) instead of JSON.stringify to avoid
 * serializing potentially huge response bodies.
 */
const PII_LOG_FIELDS = new Set(['email', 'phone', 'passport', 'nationalId', 'address', 'dateOfBirth']);

function findPIIKeys(obj, maxDepth = 6, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > maxDepth) return [];
  const found = [];
  const entries = Array.isArray(obj) ? obj.map((v, i) => [i, v]) : Object.entries(obj);
  for (const [key, value] of entries) {
    if (typeof key === 'string' && PII_LOG_FIELDS.has(key)) {
      found.push(key);
    }
    if (value && typeof value === 'object' && found.length < PII_LOG_FIELDS.size) {
      found.push(...findPIIKeys(value, maxDepth, depth + 1));
    }
    if (found.length >= PII_LOG_FIELDS.size) break; // all found, stop early
  }
  return [...new Set(found)];
}

export function piiAccessLogger(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(body) {
    // Check if response contains PII using efficient key walk
    if (body && typeof body === 'object') {
      const piiFields = findPIIKeys(body);

      if (piiFields.length > 0) {
        logger.info('PII data accessed', {
          userId: req.user?.id,
          userRole: req.user?.role,
          endpoint: `${req.method} ${req.originalUrl}`,
          piiFieldsPresent: piiFields,
          ipAddress: req.ip,
          timestamp: new Date().toISOString()
        });
      }
    }

    return originalJson(body);
  };

  next();
}

/**
 * Middleware: Sanitize PII from error responses
 *
 * Prevents PII from leaking in error messages and stack traces.
 */
export function piiErrorSanitizer(err, req, res, next) {
  if (err && err.message) {
    // Mask any email addresses in error messages
    err.message = err.message.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL_REDACTED]'
    );
    // Mask phone numbers in error messages
    err.message = err.message.replace(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      '[PHONE_REDACTED]'
    );
  }

  next(err);
}

/**
 * Middleware: Validate PII input fields
 *
 * Ensures PII data in request bodies meets format requirements
 * before it is stored.
 */
export function validatePIIInput(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object') return next();

  const errors = [];

  // Validate email format if present
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Invalid email format');
  }

  // Validate phone format if present (allow international formats)
  if (body.phone && !/^\+?[\d\s\-()]{7,20}$/.test(body.phone)) {
    errors.push('Invalid phone number format');
  }

  // Reject obviously invalid passport/ID numbers
  if (body.passport && body.passport.length < 5) {
    errors.push('Invalid passport number');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PII_VALIDATION_FAILED',
        message: 'Invalid PII data format',
        details: errors
      }
    });
  }

  next();
}

export default {
  piiResponseFilter,
  piiAccessLogger,
  piiErrorSanitizer,
  validatePIIInput
};
