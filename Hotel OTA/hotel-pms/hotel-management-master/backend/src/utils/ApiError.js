/**
 * Custom API Error class for handling application errors
 */
export class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Helper function to create common API errors
 */
export const createApiError = {
  badRequest: (message = 'Bad Request') => new ApiError(400, message),
  unauthorized: (message = 'Unauthorized') => new ApiError(401, message),
  forbidden: (message = 'Forbidden') => new ApiError(403, message),
  notFound: (message = 'Not Found') => new ApiError(404, message),
  conflict: (message = 'Conflict') => new ApiError(409, message),
  validationError: (message = 'Validation Error', errors = []) => new ApiError(422, message, errors),
  internalServer: (message = 'Internal Server Error') => new ApiError(500, message),
  serviceUnavailable: (message = 'Service Unavailable') => new ApiError(503, message)
};

export default ApiError;