/** @format */

/**
 * Application configuration module
 * Centralizes all app-level configuration settings
 */

const constants = require('@helpers/constants');

/**
 * CORS configuration
 */
const corsConfig = {
  origin: [
    ...(process.env.CORS_ORIGIN || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ...(process.env.CORS_ORIGIN_ADMIN || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  ],
  methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 200 // Legacy browser support (IE11, SmartTVs)
};

/**
 * Rate limiting configuration
 */
const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false // Disable `X-RateLimit-*` headers
};

/**
 * Session configuration
 * @param {Object} redisStore - Optional Redis store instance
 * @returns {Object} Session configuration
 */
function getSessionConfig(redisStore = null) {
  return {
    name: 'busora-sess',
    store: redisStore || undefined, // Use Redis if available, otherwise memory store
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false, // Don't save session if unmodified
    rolling: false, // Don't refresh expiration on every request
    cookie: {
      // The web app reaches the API through a same-origin proxy; "lax" also
      // keeps the cookie on top-level redirects back from a payment page.
      sameSite: 'lax',
      // Secure (HTTPS-only) unless explicitly disabled for the plain-HTTP local
      // stack — express-session never sets a secure cookie over HTTP. Behind
      // the HTTPS proxy, "trust proxy" makes requests count as secure.
      secure: process.env.SESSION_COOKIE_SECURE !== 'false',
      maxAge: constants.SESSION_TIME,
      httpOnly: true // Prevent XSS attacks
    }
  };
}

/**
 * Redis client configuration
 */
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379
  },
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0
};

/**
 * Helmet security headers configuration
 */
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
};

/**
 * Body parser configuration
 */
const bodyParserConfig = {
  urlencoded: {
    extended: true,
    limit: '10mb',
    parameterLimit: 10000
  },
  json: {
    limit: '10mb'
  }
};

/**
 * Compression configuration
 */
const compressionConfig = {
  level: 6, // Compression level (0-9)
  threshold: 1024, // Minimum size to compress (bytes)
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return true;
  }
};

/**
 * Server configuration
 */
const serverConfig = {
  port: parseInt(process.env.PORT) || 5000,
  trustProxy: 1, // Trust first proxy
  poweredBy: false // Hide X-Powered-By header
};

module.exports = {
  corsConfig,
  rateLimitConfig,
  getSessionConfig,
  redisConfig,
  helmetConfig,
  bodyParserConfig,
  compressionConfig,
  serverConfig
};
