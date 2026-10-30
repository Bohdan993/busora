/** @format */

const { strToSign } = require('@services/paymentService');

function checkCallbackSignature(req, res, next) {
  try {
    const { data, signature } = req?.body ?? {};

    console.log('checkCallbackSignature signature', signature);

    console.log('CURRENT URL1', req.originalUrl.split('?')?.[0]);
    let signatureStr;

    if (
      req.originalUrl.split('?')?.[0] === '/api/tickets/payment-fail' /*||
            req.originalUrl.split("?")?.[0] === "/api/payment/liqpay-callback"*/
    ) {
      signatureStr = strToSign(
        process.env.LIQPAY_PRIVATE_KEY +
          data?.data +
          process.env.LIQPAY_PRIVATE_KEY
      );
      if (signatureStr === signature) {
        return next();
      }
    }
    const decodedData = Buffer.from(data, 'base64').toString('utf-8');
    console.log(JSON.stringify(decodedData, null, 2), 'decodedData');

    console.log('checkCallbackSignature data', data);

    signatureStr = strToSign(
      process.env.LIQPAY_PRIVATE_KEY + data + process.env.LIQPAY_PRIVATE_KEY
    );
    if (signatureStr === signature) {
      if (req.originalUrl.split('?')?.[0] === '/api/tickets') {
        console.log('IS SIGNARURE EQUALS', true);
      }

      return next();
    }

    if (req.originalUrl.split('?')?.[0] === '/api/tickets') {
      console.log('IS SIGNARURE EQUALS', false);
    }
    console.log('CURRENT URL2', req.originalUrl.split('?')?.[0]);
    throw new Error('invalid signature');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  checkCallbackSignature
};
