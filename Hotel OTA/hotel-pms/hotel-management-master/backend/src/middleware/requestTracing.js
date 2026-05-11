import { v4 as uuidv4 } from 'uuid';

/**
 * Request tracing middleware - assigns a unique correlation ID to every request.
 * If the caller already provides an X-Request-ID header it is reused;
 * otherwise a new UUID v4 is generated.  The ID is attached to both
 * `req.requestId` and the `X-Request-ID` response header so that it can be
 * correlated across services and in client-side logs.
 */
export const requestTracing = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};
