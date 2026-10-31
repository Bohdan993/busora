/** @format */

const { createLiqPayProvider } = require('./liqPayProvider');
const { createMockPaymentProvider } = require('./mockPaymentProvider');

const MIN_MOCK_SECRET_LENGTH = 32;
const LIQPAY_ENV_KEYS = [
  'LIQPAY_PUBLIC_KEY',
  'LIQPAY_PRIVATE_KEY',
  'LIQPAY_CALLBACK_URL'
];

/**
 * Payment provider contract (both implementations):
 *   name                      'mock' | 'liqpay'
 *   sign(data)                provider signature of a string
 *   verify({data, signature}) true when the signature matches
 *   createCheckout(order)     signed { data, signature } for the frontend
 * Callbacks share LiqPay's payload shape (status, transaction_id, amount,
 * currency, info, order_id), which the ticket flow consumes.
 *
 * PAYMENT_PROVIDER selects one: "mock" (default) or "liqpay". Invalid or
 * incomplete config fails at startup.
 */
function createConfiguredProvider(env) {
  const name = env.PAYMENT_PROVIDER || 'mock';

  if (name === 'mock') {
    const secret = env.MOCK_PAYMENT_SECRET;
    if (!secret || secret.length < MIN_MOCK_SECRET_LENGTH) {
      throw new Error(
        `MOCK_PAYMENT_SECRET must be at least ${MIN_MOCK_SECRET_LENGTH} characters`
      );
    }
    return createMockPaymentProvider({ secret });
  }

  if (name === 'liqpay') {
    const missing = LIQPAY_ENV_KEYS.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`LiqPay is missing ${missing.join(', ')}`);
    }
    return createLiqPayProvider({
      publicKey: env.LIQPAY_PUBLIC_KEY,
      privateKey: env.LIQPAY_PRIVATE_KEY,
      callbackUrl: env.LIQPAY_CALLBACK_URL
    });
  }

  throw new Error(`PAYMENT_PROVIDER must be "mock" or "liqpay", got "${name}"`);
}

let configuredProvider;

// The provider selected by the environment, created on first use (after the
// env file has been loaded) and validated then.
function getPaymentProvider() {
  configuredProvider ??= createConfiguredProvider(process.env);
  return configuredProvider;
}

module.exports = {
  getPaymentProvider,
  createConfiguredProvider,
  createLiqPayProvider,
  createMockPaymentProvider
};
