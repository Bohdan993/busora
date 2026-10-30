/** @format */

const { Op } = require('sequelize');
const APIError = require('@exeptions/api-error');
const { session: Session } = require('@database/models/index');
const { strToSign } = require('@services/paymentService');

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

  const { info } = parsedData;

  const infoData = Buffer.from(info).toString('base64');

  const order_id = strToSign(
    process.env.LIQPAY_PRIVATE_KEY + infoData + process.env.LIQPAY_PRIVATE_KEY
  );

  const { date } = JSON.parse(info);
  const sessionSignatureObj = {
    order_id,
    date
  };

  const sessionSignatureData = Buffer.from(
    JSON.stringify(sessionSignatureObj)
  ).toString('base64');

  const sessionSignature = strToSign(
    process.env.LIQPAY_PRIVATE_KEY +
      sessionSignatureData +
      process.env.LIQPAY_PRIVATE_KEY
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
  getSessionData,
  deleteExpiredSessions
};
