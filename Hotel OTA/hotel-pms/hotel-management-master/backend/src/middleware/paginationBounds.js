/**
 * Global pagination bounds middleware.
 * Caps limit to 100 and ensures page >= 1 before route handlers process the query.
 */
export const paginationBounds = (req, res, next) => {
  if (req.query.limit !== undefined) {
    const parsed = parseInt(req.query.limit, 10);
    req.query.limit = String(Math.min(Math.max(isNaN(parsed) ? 20 : parsed, 1), 100));
  }
  if (req.query.page !== undefined) {
    const parsed = parseInt(req.query.page, 10);
    req.query.page = String(Math.max(isNaN(parsed) ? 1 : parsed, 1));
  }
  next();
};
