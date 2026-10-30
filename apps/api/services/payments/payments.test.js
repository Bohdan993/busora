/** @format */

// Run with:  node --test services/payments/payments.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  createLiqPayProvider,
  createMockPaymentProvider,
  createConfiguredProvider
} = require('@services/payments');

const decode = (data) => JSON.parse(Buffer.from(data, 'base64').toString());

const ORDER = {
  orderId: 'order-1',
  amount: 2500,
  currency: 'UAH',
  description: 'Kyiv → Praha',
  info: JSON.stringify({ originalCurrency: 'CZK', originalPrice: 1200 }),
  language: 'uk',
  senderFirstName: 'Olena',
  senderLastName: 'Shevchenko'
};

const MOCK_SECRET = 'test-mock-secret-that-is-at-least-32-chars';

// ─── LiqPay ─────────────────────────────────────────────────────────────────

const liqPay = createLiqPayProvider({
  publicKey: 'pub',
  privateKey: 'priv',
  callbackUrl: 'https://api.example/cb'
});

test('LiqPay signs as base64(sha1(private + data + private))', () => {
  const expected = crypto
    .createHash('sha1')
    .update('priv' + 'abc' + 'priv')
    .digest('base64');
  assert.equal(liqPay.sign('abc'), expected);
});

test('LiqPay checkout carries the LiqPay API fields and a valid signature', () => {
  const { data, signature } = liqPay.createCheckout(ORDER);
  const params = decode(data);

  assert.equal(params.public_key, 'pub');
  assert.equal(params.action, 'pay');
  assert.equal(params.version, '3');
  assert.equal(params.server_url, 'https://api.example/cb');
  assert.equal(params.order_id, 'order-1');
  assert.equal(params.amount, 2500);
  assert.equal(params.currency, 'UAH');
  assert.equal(params.info, ORDER.info);
  assert.equal(params.language, 'uk');
  assert.ok(liqPay.verify({ data, signature }));
});

test('verify rejects tampered data, wrong and missing signatures', () => {
  const { data, signature } = liqPay.createCheckout(ORDER);
  const tampered = Buffer.from(
    JSON.stringify({ ...decode(data), amount: 1 })
  ).toString('base64');

  assert.equal(liqPay.verify({ data: tampered, signature }), false);
  assert.equal(liqPay.verify({ data, signature: signature + 'x' }), false);
  assert.equal(liqPay.verify({ data, signature: undefined }), false);
  assert.equal(liqPay.verify({ data: undefined, signature }), false);
});

// ─── Mock ───────────────────────────────────────────────────────────────────

const mock = createMockPaymentProvider({ secret: MOCK_SECRET });

test('mock signs with HMAC-SHA256 of its own secret', () => {
  const expected = crypto
    .createHmac('sha256', MOCK_SECRET)
    .update('abc')
    .digest('base64');
  assert.equal(mock.sign('abc'), expected);
  assert.notEqual(mock.sign('abc'), liqPay.sign('abc'));
});

test('mock checkout is a signed order a LiqPay signature cannot forge', () => {
  const checkout = mock.createCheckout(ORDER);

  assert.ok(mock.verify(checkout));
  assert.equal(decode(checkout.data).order_id, 'order-1');
  assert.equal(
    mock.verify({ data: checkout.data, signature: liqPay.sign(checkout.data) }),
    false
  );
});

test('mock completion produces a signed LiqPay-shaped success callback', () => {
  const callback = mock.completeCheckout(mock.createCheckout(ORDER), 'success');
  const payload = decode(callback.data);

  assert.ok(mock.verify(callback));
  assert.equal(payload.status, 'success');
  assert.equal(payload.order_id, 'order-1');
  assert.equal(payload.amount, 2500);
  assert.equal(payload.currency, 'UAH');
  assert.equal(payload.info, ORDER.info);
  assert.ok(payload.transaction_id.length <= 36, 'fits tickets.transactionId');
});

test('mock completion of the same order reuses the transaction id', () => {
  const checkout = mock.createCheckout(ORDER);
  const first = decode(mock.completeCheckout(checkout, 'success').data);
  const second = decode(mock.completeCheckout(checkout, 'success').data);
  const other = decode(
    mock.completeCheckout(
      mock.createCheckout({ ...ORDER, orderId: 'order-2' }),
      'success'
    ).data
  );

  assert.equal(first.transaction_id, second.transaction_id);
  assert.notEqual(first.transaction_id, other.transaction_id);
});

test('mock completion can decline a payment', () => {
  const payload = decode(
    mock.completeCheckout(mock.createCheckout(ORDER), 'failure').data
  );
  assert.equal(payload.status, 'failure');
  assert.ok(payload.err_description);
});

test('mock completion rejects a tampered checkout and unknown outcomes', () => {
  const checkout = mock.createCheckout(ORDER);
  assert.throws(
    () =>
      mock.completeCheckout(
        { data: checkout.data, signature: 'forged' },
        'success'
      ),
    /signature/i
  );
  assert.throws(() => mock.completeCheckout(checkout, 'maybe'), /outcome/i);
});

// ─── Configuration ──────────────────────────────────────────────────────────

test('provider defaults to mock', () => {
  const provider = createConfiguredProvider({
    MOCK_PAYMENT_SECRET: MOCK_SECRET
  });
  assert.equal(provider.name, 'mock');
});

test('mock requires a secret of at least 32 characters', () => {
  assert.throws(
    () => createConfiguredProvider({ PAYMENT_PROVIDER: 'mock' }),
    /MOCK_PAYMENT_SECRET/
  );
  assert.throws(
    () =>
      createConfiguredProvider({
        PAYMENT_PROVIDER: 'mock',
        MOCK_PAYMENT_SECRET: 'short'
      }),
    /MOCK_PAYMENT_SECRET/
  );
});

test('liqpay requires its keys and callback URL', () => {
  assert.throws(
    () =>
      createConfiguredProvider({
        PAYMENT_PROVIDER: 'liqpay',
        LIQPAY_PUBLIC_KEY: 'pub'
      }),
    /LIQPAY_/
  );
  const provider = createConfiguredProvider({
    PAYMENT_PROVIDER: 'liqpay',
    LIQPAY_PUBLIC_KEY: 'pub',
    LIQPAY_PRIVATE_KEY: 'priv',
    LIQPAY_CALLBACK_URL: 'https://api.example/cb'
  });
  assert.equal(provider.name, 'liqpay');
});

test('an unknown provider name fails fast', () => {
  assert.throws(
    () => createConfiguredProvider({ PAYMENT_PROVIDER: 'paypal' }),
    /PAYMENT_PROVIDER/
  );
});
