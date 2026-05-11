/**
 * CSRF protection using double-submit cookie pattern.
 * Only enforced when authentication is via httpOnly cookies (not Bearer tokens).
 * Skips webhook routes and safe HTTP methods.
 */
export const csrfProtection = (req, res, next) => {
  // Skip safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip if using Bearer token auth (API clients, webhooks)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return next();
  }

  // Skip webhook routes
  if (req.path.includes('/webhooks/')) {
    return next();
  }

  // Only enforce CSRF if there's a cookie-based session
  if (!req.cookies?.accessToken) {
    return next();
  }

  const csrfCookie = req.cookies.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      status: 'error',
      message: 'CSRF token validation failed'
    });
  }

  next();
};
