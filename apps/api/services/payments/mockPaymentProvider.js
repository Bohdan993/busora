/** @format */

const crypto = require('crypto');
const {
  encodePayload,
  decodePayload,
  isValidSignature
} = require('./signedPayload');

const OUTCOMES = new Set(['success', 'failure']);
const MOCK_TRANSACTION_PREFIX = 'mock-';
// tickets.transactionId is varchar(36)
const TRANSACTION_ID_LENGTH = 36;

/**
 * Simulated payments for the educational demo: no money moves and no external
 * service is called. The checkout is a signed order; completing it produces a
 * signed callback in LiqPay's shape, so the rest of the booking flow (ticket,
 * PDFs, email) runs exactly as with a real payment.
 */
function createMockPaymentProvider({ secret }) {
  function sign(data) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64');
  }

  const verify = (payload) => isValidSignature(sign, payload);

  function createCheckout(order) {
    const data = encodePayload({
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      description: order.description,
      language: order.language,
      info: order.info
    });
    return { data, signature: sign(data) };
  }

  // Derived from the order, so completing the same checkout twice yields the
  // same transaction — and therefore never a second ticket.
  function transactionIdFor(orderId) {
    const hash = crypto.createHash('sha256').update(orderId).digest('hex');
    return (MOCK_TRANSACTION_PREFIX + hash).slice(0, TRANSACTION_ID_LENGTH);
  }

  function completeCheckout(checkout, outcome) {
    if (!verify(checkout)) {
      throw new Error('Invalid mock checkout signature');
    }
    if (!OUTCOMES.has(outcome)) {
      throw new Error(`Unknown mock payment outcome: ${outcome}`);
    }

    const order = decodePayload(checkout.data);
    const data = encodePayload({
      status: outcome,
      ...(outcome === 'failure' && {
        err_description: 'Payment declined (mock)'
      }),
      transaction_id: transactionIdFor(order.order_id),
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      description: order.description,
      info: order.info,
      create_date: Date.now()
    });
    return { data, signature: sign(data) };
  }

  return {
    name: 'mock',
    sign,
    verify,
    createCheckout,
    completeCheckout
  };
}

module.exports = { createMockPaymentProvider };
