/** @format */
require('module-alias/register');
const express = require('express');
const fs = require('fs');
const https = require('https');
const RedisStore = require('connect-redis').default;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const session = require('express-session');
const { createClient } = require('redis');
const Fingerprint = require('express-fingerprint');
const path = require('path');
const validate = require('validate.js');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Internal imports
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../config/swagger');
const logger = require('@services/loggerService');
const { getPaymentProvider } = require('@services/payments');
const {
  corsConfig,
  rateLimitConfig,
  getSessionConfig,
  redisConfig,
  helmetConfig,
  bodyParserConfig,
  compressionConfig,
  serverConfig
} = require('../config/app.config');
const { responseHelpers } = require('@helpers/responseFormatter');
const {
  requestIdMiddleware,
  requestLoggingMiddleware,
  attachLoggerContext
} = require('@middlewares/requestMiddleware');

const app = express();

// HTTPS is opt-in for local development: set both cert paths to enable it.
// Without them (e.g. inside Docker, behind a proxy) the API serves plain HTTP.
const httpsKeyPath = process.env.DEV_HTTPS_KEY_PATH;
const httpsCertPath = process.env.DEV_HTTPS_CERT_PATH;
const server =
  process.env.NODE_ENV === 'development' && httpsKeyPath && httpsCertPath
    ? https.createServer(
        {
          key: fs.readFileSync(path.resolve(httpsKeyPath), 'utf-8'),
          cert: fs.readFileSync(path.resolve(httpsCertPath), 'utf-8')
        },
        app
      )
    : null;

logger.info(server ? 'HTTPS server created' : 'HTTP server created');

const authRoute = require('@api/routes/admin/auth');
const agentsAdminRoute = require('@api/routes/admin/agents');
const busflightsAdminRoute = require('@api/routes/admin/busFlights');
const citiesAdminRoute = require('@api/routes/admin/cities');
const currenciesAdminRoute = require('@api/routes/admin/currencies');
const discountsAdminRoute = require('@api/routes/admin/discounts');
const searchAdminRoute = require('@api/routes/admin/search');
const ticketsAdminRoute = require('@api/routes/admin/tickets');
// const passengersAdminRoute = require("./routes/admin/passengers");
const routesAdminRoute = require('@api/routes/admin/routes');
const citiesRoute = require('@api/routes/cities');
const currenciesRoute = require('@api/routes/currencies');
const busflightsRoute = require('@api/routes/busFlights');
const passengersRoute = require('@api/routes/passengers');
const paymentRoute = require('@api/routes/payment');
const ticketsRoute = require('@api/routes/tickets');
const sessionDataRoute = require('@api/routes/sessionData');
const networkRoute = require('@api/routes/network');
const discountsRoute = require('@api/routes/discounts');
// const insertDataRoute = require("@api/routes/insertDatainDB");
const { handleError } = require('@middlewares/errorMiddlewares');
const APIError = require('@exeptions/api-error');
const { preventSQLInjection } = require('@middlewares/validationMiddleware');
const { validateLanguageCode } = require('@middlewares/languageMiddleware');

const PORT = process.env.PORT || 5000;

// Redis client configuration (optional - only if using Redis for sessions)
let redisClient = null;
let redisStore = null;

if (process.env.REDIS_HOST) {
  redisClient = createClient(redisConfig);

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  // Connect to Redis
  redisClient.connect().catch((err) => {
    logger.error('Failed to connect to Redis', err);
    redisClient = null;
  });

  redisStore = new RedisStore({
    client: redisClient,
    prefix: 'busora:'
  });
}

const sessionOptions = getSessionConfig(redisStore);

if (!redisStore) {
  logger.warn(
    'Redis not configured - using memory store for sessions (not recommended for production)'
  );
}

validate.extend(validate.validators.datetime, {
  parse: function (value, options) {
    const timestamp = +new Date(value);
    return timestamp;
  },
  // Input is a unix timestamp
  format: function (value, options) {
    return new Date(value).toLocaleDateString().replace(/[\.\/]/g, '-');
  }
});

app.set('trust proxy', 1);
app.set('x-powered-by', false);

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.logSecurity('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later.'
    });
  }
});

// Helmet configuration with custom options
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  })
);

// Request tracking (should be first)
app.use(requestIdMiddleware);
app.use(attachLoggerContext);
app.use(requestLoggingMiddleware);

// Response helpers
app.use(responseHelpers);

// Core middleware
app.use(cors(corsConfig));
app.use(limiter);
app.use(bodyParser.urlencoded(bodyParserConfig.urlencoded));
app.use(bodyParser.json(bodyParserConfig.json));
app.use(cookieParser());
app.use(session(sessionOptions));
app.use(Fingerprint());
app.use(compression(compressionConfig));

// SQL injection prevention (before routes)
app.use(preventSQLInjection);

// Unknown ?languageCode= values never reach translation-file lookups
app.use('/api', validateLanguageCode);

// ── Swagger UI ────────────────────────────────────────────────────────────────
// Served at /api-docs. Override CSP for this path only so swagger-ui assets load.
app.use('/api-docs', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:"
  );
  next();
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Busora API Docs'
  })
);

app.use('/api/cities', citiesRoute);
app.use('/api/currencies', currenciesRoute);
app.use('/api/bus-flights', busflightsRoute);
app.use('/api/passengers', passengersRoute);
app.use('/api/tickets', ticketsRoute);
app.use('/api/payment', paymentRoute);
app.use('/api/current-data', sessionDataRoute);
app.use('/api/network', networkRoute);
app.use('/api/discounts', discountsRoute);
// app.use("/api/insert", insertDataRoute);

app.use('/api/admin/auth', authRoute);
app.use('/api/admin/agents', agentsAdminRoute);
app.use('/api/admin/bus-flights', busflightsAdminRoute);
app.use('/api/admin/cities', citiesAdminRoute);
app.use('/api/admin/currencies', currenciesAdminRoute);
app.use('/api/admin/discounts', discountsAdminRoute);
app.use('/api/admin/routes', routesAdminRoute);
app.use('/api/admin/search', searchAdminRoute);
app.use('/api/admin/tickets', ticketsAdminRoute);
// app.use("/api/admin/passengers", passengersAdminRoute);
// app.use("/api/admin/users", authRoute);

// Unknown API paths answer in the same JSON error shape as everything else
app.use('/api', (req, res, next) =>
  next(APIError.NotFoundError(`no route ${req.method} ${req.originalUrl}`))
);

app.use(handleError);

async function start() {
  try {
    // Fail fast on missing/invalid payment config instead of on the first payment
    const paymentProvider = getPaymentProvider();
    logger.info(`Payment provider: ${paymentProvider.name}`);

    if (server) {
      server.listen(PORT, () => {
        logger.info(`🚀 Development server (HTTPS) running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info(`Session store: ${redisStore ? 'Redis' : 'Memory'}`);
      });
    } else {
      app.listen(PORT, () => {
        logger.info(`🚀 Server (HTTP) running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info(`Session store: ${redisStore ? 'Redis' : 'Memory'}`);
      });
    }
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// `app` is exported for in-process HTTP tests; `start` is what index.js runs
module.exports = {
  app,
  start
};
