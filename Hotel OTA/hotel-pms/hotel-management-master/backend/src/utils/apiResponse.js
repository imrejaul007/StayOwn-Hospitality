/**
 * Standard API Response class for consistent response formatting
 */
export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

/**
 * Standardized API Response Helpers
 *
 * Ensures every endpoint uses a consistent JSON envelope:
 *
 *   Success: { status: 'success', data, pagination?, message? }
 *   Error:   { status: 'error',   error: { code, message, statusCode, details? } }
 *
 * Usage in routes / controllers:
 *   import { sendSuccess, sendPaginated, sendError } from '../utils/apiResponse.js';
 *   sendSuccess(res, data);
 *   sendPaginated(res, data, pagination);
 *   sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input');
 */

/**
 * Send a successful JSON response.
 * @param {Response} res - Express response object
 * @param {*} data - Response payload
 * @param {number} statusCode - HTTP status (default 200)
 * @param {string} [message] - Optional human-readable message
 */
export const sendSuccess = (res, data, statusCode = 200, message) => {
  const body = { status: 'success', data };
  if (message) body.message = message;
  return res.status(statusCode).json(body);
};

/**
 * Send a paginated JSON response.
 * @param {Response} res - Express response object
 * @param {*} data - Array of items
 * @param {Object} pagination - { currentPage, totalPages, totalCount, limit, hasNextPage, hasPrevPage }
 * @param {number} statusCode - HTTP status (default 200)
 */
export const sendPaginated = (res, data, pagination, statusCode = 200) => {
  return res.status(statusCode).json({
    status: 'success',
    results: Array.isArray(data) ? data.length : undefined,
    data,
    pagination
  });
};

/**
 * Send a standardized error response.
 * Prefer throwing ApplicationError and letting the global error handler catch it.
 * Use this only when you need to send an error without throwing.
 * @param {Response} res
 * @param {number} statusCode
 * @param {string} code - Machine-readable code (e.g. 'VALIDATION_ERROR')
 * @param {string} message - Human-readable message
 * @param {Object} [details] - Additional error context
 */
export const sendError = (res, statusCode, code, message, details) => {
  const body = {
    status: 'error',
    error: {
      code,
      message,
      statusCode
    }
  };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
};

export default ApiResponse;
