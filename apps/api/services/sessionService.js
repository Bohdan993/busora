/** @format */

const { Op } = require('sequelize');
const APIError = require('@exeptions/api-error');
const { session: Session } = require('@database/models/index');
const { getPaymentProvider } = require('@services/payments');

const toBase64 = (str) => Buffer.from(str).toString('base64');

/**
 * Derives a booking's payment keys from its `info` string (JSON with the
 * booking `date`): the order id sent to the payment provider, and the
 * signature that keys the saved booking session. Both are signed by the
 * payment provider, so they can't be forged without its secret.
 */
function deriveOrderKeys(info) {
  const { sign } = getPaymentProvider();
  const orderId = sign(toBase64(info));
  const { date } = JSON.parse(info);
  const sessionSignature = sign(
    toBase64(JSON.stringify({ order_id: orderId, date }))
  );
  return { orderId, sessionSignature };
}

async function getSessionData(parsedData) {
  if (
    parsedData?.err_code ||
    parsedData?.err_erc ||
    parsedData?.status !== 'success'
  ) {
    throw APIError.BadRequestError(
      parsedData?.status +
        (parsedData?.err_description
          ? ' (' + parsedData.err_description + ')'
          : '')
    );
  }

  const { orderId: order_id, sessionSignature } = deriveOrderKeys(
    parsedData.info
  );
  const session = await Session.findOne({
    where: {
      signature: sessionSignature
    }
  });

  // The booking session is a DB row that deleteExpiredSessions() purges at the
  // end of every callback. A late/retried callback can therefore find it gone.
  // Guard explicitly — destructuring `sessionInfo` off a null session would
  // throw an opaque TypeError; a clear domain error is easier to act on.
  if (!session || !session.sessionInfo) {
    throw APIError.BadRequestError(
      `Booking session not found or empty for order ${order_id} — it may have expired or already been purged.`
    );
  }

  const { sessionInfo } = session;

  const sessionInfoData = JSON.parse(sessionInfo);

  return {
    sessionInfoData,
    order_id
  };
}

async function deleteExpiredSessions() {
  let result;
  const sessions = await Session.findAll({
    where: {
      expires: {
        [Op.lt]: new Date()
      }
    }
  });

  if (sessions.length) {
    result = await Promise.all(
      sessions.map(async (sess) => {
        await sess.destroy();
        return 1;
      })
    );
  }

  return result;
}

module.exports = {
  deriveOrderKeys,
  getSessionData,
  deleteExpiredSessions
};
