/** @format */

const TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS';

/**
 * The express-rate-limit handler: answers in the public error shape, so
 * clients can tell "slow down" apart from "the API is unreachable".
 */
function createRateLimitHandler(logger) {
  return (req, res) => {
    logger.logSecurity('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      status: 'fail',
      code: TOO_MANY_REQUESTS,
      message: 'Too many requests, please try again later.',
      errors: []
    });
  };
}

module.exports = { createRateLimitHandler, TOO_MANY_REQUESTS };
