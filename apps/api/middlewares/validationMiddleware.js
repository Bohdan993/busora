/** @format */

const { validationResult } = require('express-validator');
const APIError = require('@exeptions/api-error');
const AdminAPIError = require('@exeptions/admin/api-error');
const logger = require('@services/loggerService');
const { LOCALES } = require('@root/config/market');

/**
 * Middleware to handle validation results from express-validator
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    logger.logSecurity('Validation failed', {
      ip: req.ip,
      path: req.path,
      errors: errorMessages
    });

    // Determine if this is an admin route
    const isAdminRoute = req.originalUrl.includes('/admin');

    if (isAdminRoute) {
      throw AdminAPIError.ValidationError('Validation failed', errorMessages);
    } else {
      throw APIError.ValidationError('Validation failed', errorMessages);
    }
  }

  next();
}

/**
 * Sanitize and validate common input patterns
 */
const validators = {
  // Email validation
  email: {
    trim: true,
    isEmail: {
      errorMessage: 'Invalid email address'
    },
    normalizeEmail: true
  },

  // Password validation
  password: {
    isLength: {
      options: { min: 6, max: 128 },
      errorMessage: 'Password must be between 6 and 128 characters'
    }
  },

  // ID validation (numeric)
  id: {
    isInt: {
      options: { min: 1 },
      errorMessage: 'ID must be a positive integer'
    },
    toInt: true
  },

  // String validation
  string: (fieldName, minLength = 1, maxLength = 255) => ({
    trim: true,
    isLength: {
      options: { min: minLength, max: maxLength },
      errorMessage: `${fieldName} must be between ${minLength} and ${maxLength} characters`
    },
    escape: true
  }),

  // Date validation
  date: {
    isISO8601: {
      errorMessage: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
    },
    toDate: true
  },

  // Phone number validation
  phone: {
    trim: true,
    matches: {
      options: [/^[\d\s\-\+\(\)]+$/],
      errorMessage: 'Invalid phone number format'
    }
  },

  // Language code validation
  languageCode: {
    isIn: {
      options: [LOCALES],
      errorMessage: 'Invalid language code'
    }
  },

  // Currency abbreviation
  currency: {
    isIn: {
      options: [['UAH', 'CZK']],
      errorMessage: 'Invalid currency'
    }
  },

  // Positive integer
  positiveInt: (fieldName) => ({
    isInt: {
      options: { min: 0 },
      errorMessage: `${fieldName} must be a positive integer`
    },
    toInt: true
  }),

  // Boolean
  boolean: {
    isBoolean: {
      errorMessage: 'Must be a boolean value'
    },
    toBoolean: true
  }
};

/**
 * Sanitize object by removing null, undefined, and empty strings
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
function sanitizeObject(obj) {
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to sanitize request body
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Middleware to sanitize query parameters
 */
function sanitizeQuery(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

/**
 * Prevent SQL injection by checking for suspicious patterns
 */
function preventSQLInjection(req, res, next) {
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  const checkObject = (obj) => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (checkObject(value)) return true;
      } else if (checkValue(value)) {
        return true;
      }
    }
    return false;
  };

  if (
    checkObject(req.body || {}) ||
    checkObject(req.query || {}) ||
    checkObject(req.params || {})
  ) {
    logger.logSecurity('Potential SQL injection attempt detected', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    return res.status(400).json({
      status: 'error',
      message: 'Invalid request'
    });
  }

  next();
}

module.exports = {
  handleValidationErrors,
  validators,
  sanitizeObject,
  sanitizeBody,
  sanitizeQuery,
  preventSQLInjection
};
