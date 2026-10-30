/** @format */

const crypto = require('crypto');

// Payment payloads travel as base64(JSON) plus a signature over that string —
// LiqPay's format, which the mock provider reuses.
const encodePayload = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64');

const decodePayload = (data) =>
  JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));

// Constant-time comparison so a signature can't be guessed byte by byte.
function isValidSignature(sign, { data, signature } = {}) {
  if (typeof data !== 'string' || typeof signature !== 'string') return false;
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

module.exports = { encodePayload, decodePayload, isValidSignature };
