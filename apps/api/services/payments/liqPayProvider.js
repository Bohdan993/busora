/** @format */

const crypto = require('crypto');
const { encodePayload, isValidSignature } = require('./signedPayload');

const LIQPAY_API_VERSION = '3';
const LIQPAY_PAY_TYPES = 'card, liqpay, qr';

/**
 * LiqPay (https://www.liqpay.ua/documentation/api/aquiring/checkout/doc).
 * The frontend opens the LiqPay widget with { data, signature }; LiqPay then
 * calls LIQPAY_CALLBACK_URL with a signed payload of the same shape.
 */
function createLiqPayProvider({ publicKey, privateKey, callbackUrl }) {
  function sign(data) {
    return crypto
      .createHash('sha1')
      .update(privateKey + data + privateKey)
      .digest('base64');
  }

  function createCheckout(order) {
    const data = encodePayload({
      public_key: publicKey,
      action: 'pay',
      amount: order.amount,
      currency: order.currency,
      description: order.description,
      order_id: order.orderId,
      version: LIQPAY_API_VERSION,
      paytypes: LIQPAY_PAY_TYPES,
      language: order.language,
      info: order.info,
      sender_first_name: order.senderFirstName,
      sender_last_name: order.senderLastName,
      server_url: callbackUrl
    });
    return { data, signature: sign(data) };
  }

  return {
    name: 'liqpay',
    sign,
    verify: (payload) => isValidSignature(sign, payload),
    createCheckout
  };
}

module.exports = { createLiqPayProvider };
