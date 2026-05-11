/**
 * Higher-order function to handle async/await errors in Express routes
 * Automatically catches any Promise rejections and passes them to Express error handler
 *
 * @param {Function} requestHandler - The async function to wrap
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

/**
 * Alternative implementation using try-catch
 * Less elegant but more explicit
 */
export const asyncHandlerTryCatch = (requestHandler) => {
  return async (req, res, next) => {
    try {
      await requestHandler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

export default asyncHandler;