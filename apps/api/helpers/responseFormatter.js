/** @format */

/**
 * Response formatter utility
 * Provides consistent response structure across all API endpoints
 */

const logger = require('@services/loggerService');

/**
 * Send successful response
 *
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 * @param {Object} meta - Optional metadata
 */
function sendSuccess(
  res,
  data,
  message = 'Success',
  statusCode = 200,
  sessionExpiresTime = null,
  meta = {}
) {
  const response = {
    status: 'ok',
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  if (sessionExpiresTime) {
    response.sessionExpiresTime = sessionExpiresTime;
  }

  // Add request ID if available
  if (res.req?.id) {
    response.meta.requestId = res.req.id;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send error response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array|Object} errors - Detailed errors
 * @param {string} code - Error code
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendError(
  res,
  message = 'An error occurred',
  statusCode = 500,
  errors = [],
  code = 'ERROR',
  sessionExpiresTime = null
) {
  const response = {
    status: 'error',
    success: false,
    message,
    code,
    errors: Array.isArray(errors) ? errors : [errors],
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  if (sessionExpiresTime) {
    response.sessionExpiresTime = sessionExpiresTime;
  }

  // Add request ID if available
  if (res.req?.id) {
    response.meta.requestId = res.req.id;
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    response.message = 'Internal server error';
    response.errors = [];
  }

  return res.status(statusCode).json(response);
}

/**
 * Send paginated response
 *
 * @param {Object} res - Express response object
 * @param {Array} data - Response data
 * @param {Object} pagination - Pagination info
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendPaginated(res, data, pagination, sessionExpiresTime = null) {
  const { page, limit, total, totalPages } = pagination;

  return sendSuccess(res, data, 'Success', 200, sessionExpiresTime, {
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages: parseInt(totalPages),
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

/**
 * Send created response (201)
 *
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendCreated(
  res,
  data,
  message = 'Resource created successfully',
  sessionExpiresTime = null
) {
  return sendSuccess(res, data, message, 201, sessionExpiresTime);
}

/**
 * Send no content response (204)
 *
 * @param {Object} res - Express response object
 */
function sendNoContent(res) {
  return res.status(204).end();
}

/**
 * Send validation error response (422)
 *
 * @param {Object} res - Express response object
 * @param {Array} errors - Validation errors
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendValidationError(res, errors, sessionExpiresTime = null) {
  return sendError(
    res,
    'Validation failed',
    422,
    errors,
    'VALIDATION_ERROR',
    sessionExpiresTime
  );
}

/**
 * Send not found response (404)
 *
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendNotFound(res, resource = 'Resource', sessionExpiresTime = null) {
  return sendError(
    res,
    `${resource} not found`,
    404,
    [],
    'NOT_FOUND',
    sessionExpiresTime
  );
}

/**
 * Send unauthorized response (401)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendUnauthorized(
  res,
  message = 'Unauthorized',
  sessionExpiresTime = null
) {
  return sendError(res, message, 401, [], 'UNAUTHORIZED', sessionExpiresTime);
}

/**
 * Send forbidden response (403)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number|null} sessionExpiresTime - Optional session expiration time in seconds
 */
function sendForbidden(res, message = 'Forbidden', sessionExpiresTime = null) {
  return sendError(res, message, 403, [], 'FORBIDDEN', sessionExpiresTime);
}

/**
 * Helper to calculate pagination metadata
 *
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @returns {Object} Pagination metadata
 */
function calculatePagination(page = 1, limit = 10, total = 0) {
  const totalPages = Math.ceil(total / limit);

  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages,
    offset: (page - 1) * limit
  };
}

/**
 * Middleware to attach response helpers to res object
 */
function responseHelpers(req, res, next) {
  res.sendSuccess = (data, message, statusCode, sessionExpiresTime, meta) =>
    sendSuccess(res, data, message, statusCode, sessionExpiresTime, meta);

  res.sendError = (message, statusCode, errors, code, sessionExpiresTime) =>
    sendError(res, message, statusCode, errors, code, sessionExpiresTime);

  res.sendPaginated = (data, pagination, sessionExpiresTime) =>
    sendPaginated(res, data, pagination, sessionExpiresTime);

  res.sendCreated = (data, message, sessionExpiresTime) =>
    sendCreated(res, data, message, sessionExpiresTime);

  res.sendNoContent = () => sendNoContent(res);

  res.sendValidationError = (errors, sessionExpiresTime) =>
    sendValidationError(res, errors, sessionExpiresTime);

  res.sendNotFound = (resource, sessionExpiresTime) =>
    sendNotFound(res, resource, sessionExpiresTime);

  res.sendUnauthorized = (message, sessionExpiresTime) =>
    sendUnauthorized(res, message, sessionExpiresTime);

  res.sendForbidden = (message, sessionExpiresTime) =>
    sendForbidden(res, message, sessionExpiresTime);

  next();
}

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  calculatePagination,
  responseHelpers
};
