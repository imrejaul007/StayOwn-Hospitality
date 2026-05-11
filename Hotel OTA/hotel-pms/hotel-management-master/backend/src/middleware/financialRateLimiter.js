import rateLimit from 'express-rate-limit';

/**
 * Shared rate limiter for all financial/monetary routes.
 * Limits to 30 requests per minute per IP to prevent abuse of
 * financial endpoints (invoices, billing, POS, revenue, budgets, etc.).
 */
const financialRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for financial operations
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many financial requests. Please try again shortly.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default financialRateLimiter;
