/** @format */

const APIError = require('@exeptions/api-error');
const { getPaymentProvider } = require('@services/payments');

const PAYMENT_FAIL_PATH = '/api/tickets/payment-fail';

/**
 * Rejects requests whose { data, signature } body was not signed by the
 * configured payment provider. The payment-fail report wraps the provider's
 * payload one level deeper ({ data: { data }, signature }).
 */
function checkCallbackSignature(req, res, next) {
  const { data, signature } = req?.body ?? {};
  const signedData =
    req.originalUrl.split('?')[0] === PAYMENT_FAIL_PATH ? data?.data : data;

  if (getPaymentProvider().verify({ data: signedData, signature })) {
    return next();
  }
  return next(APIError.BadRequestError('invalid signature'));
}

module.exports = {
  checkCallbackSignature
};
