/** @format */

const { v4: uuidv4 } = require('uuid');
const logger = require('@services/loggerService');

/**
 * Middleware to add unique request ID to each request
 * The ID can be used to trace requests through logs
 */
function requestIdMiddleware(req, res, next) {
  // Check if request already has an ID (from client or proxy)
  req.id = req.headers['x-request-id'] || uuidv4();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Store start time for request duration tracking
  req.startTime = Date.now();

  next();
}

/**
 * Middleware to log request completion with timing
 */
function requestLoggingMiddleware(req, res, next) {
  // Store original end function
  const originalEnd = res.end;

  // Override end function to log when response is sent
  res.end = function (...args) {
    const duration = Date.now() - req.startTime;

    logger.http('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Middleware to attach request ID to logger context
 * This allows all logs within a request to be traced
 */
function attachLoggerContext(req, res, next) {
  // Create a child logger with request context
  req.logger = {
    info: (message, meta = {}) =>
      logger.info(message, { requestId: req.id, ...meta }),
    warn: (message, meta = {}) =>
      logger.warn(message, { requestId: req.id, ...meta }),
    error: (message, meta = {}) =>
      logger.error(message, { requestId: req.id, ...meta }),
    debug: (message, meta = {}) =>
      logger.debug(message, { requestId: req.id, ...meta })
  };

  next();
}

module.exports = {
  requestIdMiddleware,
  requestLoggingMiddleware,
  attachLoggerContext
};
