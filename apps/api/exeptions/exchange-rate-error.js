/**
 * An exchange rate could not be resolved (rate source down, currency unknown,
 * bad data). Mapped to 503 by the central error handler: charging with a
 * guessed rate would bill the customer a wrong amount.
 */
class ExchangeRateError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ExchangeRateError';
  }
}

module.exports = ExchangeRateError;
