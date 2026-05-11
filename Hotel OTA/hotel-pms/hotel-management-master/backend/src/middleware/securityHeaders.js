import crypto from 'crypto';

/**
 * Additional security middleware beyond Helmet defaults.
 */

/**
 * Prevent sensitive data from being cached by browsers/proxies.
 */
const noCacheForSensitive = (sensitivePatterns = ['/auth', '/payment', '/financial', '/gdpr', '/admin']) => {
  return (req, res, next) => {
    const isSensitive = sensitivePatterns.some(p => req.path.includes(p));
    if (isSensitive) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    }
    next();
  };
};

/**
 * Request ID middleware for tracing.
 */
const requestId = (req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.set('X-Request-ID', id);
  next();
};

/**
 * Sanitize MongoDB operators from request body/query to prevent NoSQL injection.
 * Works as a safety net in addition to express-mongo-sanitize.
 */
const sanitizeMongoOperators = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  next();
};

export {
  noCacheForSensitive,
  requestId,
  sanitizeMongoOperators,
};
