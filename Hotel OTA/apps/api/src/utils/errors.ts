export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const Errors = {
  authRequired: () => new AppError(401, 'AUTH_REQUIRED', 'Authentication required'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'Insufficient permissions'),
  notFound: (resource: string) => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  badRequest: (message: string) => new AppError(400, 'BAD_REQUEST', message),
  validation: (message: string, details: Record<string, unknown> = {}) =>
    new AppError(422, 'VALIDATION_ERROR', message, details),
  inventoryUnavailable: () => new AppError(409, 'INVENTORY_UNAVAILABLE', 'No rooms available for selected dates'),
  holdExpired: () => new AppError(409, 'HOLD_EXPIRED', 'Booking hold has expired'),
  coinInsufficient: () => new AppError(400, 'COIN_INSUFFICIENT', 'Not enough coin balance'),
  coinCapExceeded: (reason: string) => new AppError(400, 'COIN_CAP_EXCEEDED', reason),
  paymentFailed: (message: string) => new AppError(402, 'PAYMENT_FAILED', message),
  rateLimited: () => new AppError(429, 'RATE_LIMITED', 'Too many requests'),
  internal: (message = 'Internal server error') => new AppError(500, 'INTERNAL_ERROR', message),
};
