/** @format */

const APIError = require('@exeptions/api-error');
const AdminAPIError = require('@exeptions/admin/api-error');
const ExchangeRateError = require('@exeptions/exchange-rate-error');

function handleError(err, req, res, next) {
  console.error('[API error]: ', err);

  if (err instanceof APIError) {
    return res.status(err.status).json({
      status: 'fail',
      code: err.code,
      message: err.message,
      errors: err.errors
    });
  }

  if (err instanceof AdminAPIError) {
    return res
      .status(err.status)
      .json({ status: err.message, error: err.errors });
  }

  if (err instanceof ExchangeRateError) {
    return res.status(503).json({
      status: 'fail',
      code: 'EXCHANGE_RATE_UNAVAILABLE',
      message: 'Exchange rate temporarily unavailable'
    });
  }

  // Never echo an unexpected error's message: it can carry SQL or file paths
  return res.status(500).json({
    status: 'fail',
    code: 'SERVER_ERROR',
    message: 'Server error'
  });
}

module.exports = {
  handleError
};
