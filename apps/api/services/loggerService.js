/** @format */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false
});

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Helper functions for structured logging
logger.logRequest = (req, message = 'Incoming request') => {
  logger.http(message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
};

logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};

logger.logSecurity = (event, details = {}) => {
  logger.warn(`[SECURITY] ${event}`, {
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.logPayment = (event, details = {}) => {
  // Sanitize sensitive payment data
  const sanitizedDetails = { ...details };
  if (sanitizedDetails.cardNumber) {
    sanitizedDetails.cardNumber =
      '****' + sanitizedDetails.cardNumber.slice(-4);
  }

  logger.info(`[PAYMENT] ${event}`, {
    ...sanitizedDetails,
    timestamp: new Date().toISOString()
  });
};

// Only log to files in production
if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logging initialized at debug level');
}

module.exports = logger;
