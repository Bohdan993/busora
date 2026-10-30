/** @format */

const { Router } = require('express');
const router = Router();
const pug = require('pug');
const path = require('path');
const {
  strToSign,
  calculatePrice,
  parsePaymentCallbackData,
  preparePassengerDataForEmail
} = require('@services/paymentService');
const {
  loadLanguageFile,
  transformTimestampToDate,
  sleep
} = require('@helpers');
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');
const {
  checkIfBusFlightSelected
} = require('@middlewares/busFlightMiddlewares');
const {
  checkIfPassengersInfoExists
} = require('@middlewares/passengersMiddleware');
const constants = require('@helpers/constants.js');
const { getPaymentLanguage } = require('@root/config/market');
const { session: Session, ticket: Ticket } = require('@database/models/index');
const { createTicket } = require('@services/ticketService');
const {
  getOrCreateTicket,
  ensureTicketPDFAndSendEmail
} = require('@services/ticketPdfService');
const { checkCallbackSignature } = require('@middlewares/paymentMiddlewares');
const {
  getTicketSubject,
  sendAdminAlertMail
} = require('@services/mailService');
const {
  getSessionData,
  deleteExpiredSessions
} = require('@services/sessionService');
const logger = require('@services/loggerService');

// LiqPay retries the callback for the same order many times (~15+ over a couple
// of hours). Each genuine "paid but ticket not delivered" failure would send a
// fresh admin alert, flooding the inbox (the 2026-08-18 incident: one ticket,
// 15+ identical alerts). Remember which transactions we've already emailed about
// and alert at most once each — every failure is still logged. Best-effort,
// in-memory, per PM2 worker; the real prevention is atomic ticket creation
// (a failure no longer leaves an unrecoverable orphan). Bounded so a
// long-running process can't grow the set without limit.
const alertedTransactionIds = new Set();
const ALERTED_TX_CAP = 1000;

function markAndCheckAlerted(transactionId) {
  // An unknown id can't be de-duplicated — let it through so we never swallow
  // a real alert.
  if (transactionId == null) return false;
  if (alertedTransactionIds.has(transactionId)) return true;
  if (alertedTransactionIds.size >= ALERTED_TX_CAP) {
    // Evict the oldest entry (insertion order) to bound memory.
    const oldest = alertedTransactionIds.values().next().value;
    alertedTransactionIds.delete(oldest);
  }
  alertedTransactionIds.add(transactionId);
  return false;
}

/**
 * @swagger
 * /api/payment:
 *   post:
 *     summary: Get the LiqPay payment widget
 *     description: >
 *       Calculates the ticket price, signs the LiqPay parameters, persists the
 *       session to the DB, and returns the rendered payment-widget HTML. Requires
 *       a complete session: started → flight selected → passengers validated.
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *     responses:
 *       200:
 *         description: Payment widget HTML and discount flag
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     html:
 *                       type: string
 *                       description: Rendered LiqPay widget HTML
 *                     hasDiscount:
 *                       type: boolean
 *                       description: Whether the BUS_FLIGHT discount is active for this booking
 *                 sessionExpiresTime:
 *                   type: integer
 *       401:
 *         description: Session not started / flight not selected / passengers missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  [
    checkIfSessionIsStarted,
    checkIfBusFlightSelected,
    checkIfPassengersInfoExists
  ],
  async (req, res, next) => {
    try {
      const { languageCode = 'uk_UA' } = req?.query ?? {};

      const {
        currency,
        passengersInfo,
        selectedBusFlight,
        email,
        currencyExchangeRate
      } = req.session;

      const price = calculatePrice({ data: passengersInfo });
      const currDate = Date.now();
      const ticketPrice = Math.round(
        Number(price) * Number(currencyExchangeRate)
      );

      const passengersInfoData = Object.entries(passengersInfo);
      const firstPassaneger = passengersInfoData[0][1];
      const firstPassanegerPhoneNum = firstPassaneger[`phone-1`];
      const firstPassanegerName = firstPassaneger[`name-1`];
      const firstPassanegerLastName = firstPassaneger[`last-name-1`];

      const infoObj = {
        originalCurrency: currency?.abbr,
        originalPrice: price,
        languageCode: languageCode,
        date: currDate
      };
      const infoObjString = JSON.stringify(infoObj);

      const infoData = Buffer.from(infoObjString).toString('base64');
      const infoDataSignature = strToSign(
        process.env.LIQPAY_PRIVATE_KEY +
          infoData +
          process.env.LIQPAY_PRIVATE_KEY
      );

      const params = {
        public_key: process.env.LIQPAY_PUBLIC_KEY,
        action: 'pay',
        amount: ticketPrice,
        currency: 'UAH',
        description: 'Оплата за ' + getTicketSubject(selectedBusFlight),
        order_id: infoDataSignature,
        version: '3',
        paytypes: 'card, liqpay, qr',
        language: getPaymentLanguage(languageCode),
        info: infoObjString,
        sender_first_name: `(${firstPassanegerPhoneNum}) ${firstPassanegerName}`,
        sender_last_name: `(${email}) ${firstPassanegerLastName}`,
        server_url: process.env.LIQPAY_CALLBACK_URL
      };

      console.log('MY LOG PAYMENT PARAMS: ', params);

      const data = Buffer.from(JSON.stringify(params)).toString('base64');
      const signature = strToSign(
        process.env.LIQPAY_PRIVATE_KEY + data + process.env.LIQPAY_PRIVATE_KEY
      );
      const sessionSignatureObj = {
        order_id: params.order_id,
        date: currDate
      };

      const sessionSignatureData = Buffer.from(
        JSON.stringify(sessionSignatureObj)
      ).toString('base64');
      const sessionSignature = strToSign(
        process.env.LIQPAY_PRIVATE_KEY +
          sessionSignatureData +
          process.env.LIQPAY_PRIVATE_KEY
      );

      await Session.create({
        sessionInfo: JSON.stringify(req.session),
        expires: Date.now() + constants.SESSION_TIME * 2,
        signature: sessionSignature
      });

      // req.session.flag = !req.session.flag;
      return req.session.save(function (err) {
        if (err) return next(err);

        const template = path.resolve('views', 'payment-widget.pug');
        const html = pug.renderFile(template, {
          data,
          signature,
          translations: loadLanguageFile('payment-widget.js', languageCode),
          language: getPaymentLanguage(languageCode),
          linkToMain:
            languageCode === 'uk_UA' ? '/' : languageCode.split('_')[0]
        });

        console.log('MY LOG PAYMENT SESSION', req.session);

        return res.json({
          status: 'ok',
          data: {
            html: html,
            hasDiscount: selectedBusFlight.hasDiscount
          },
          sessionExpiresTime: constants.SESSION_TIME
        });
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/payment/liqpay-callback:
 *   post:
 *     summary: LiqPay server-to-server payment callback
 *     description: >
 *       Webhook called directly by LiqPay servers after payment is processed.
 *       Verifies the HMAC signature, creates/reuses the ticket, generates PDFs,
 *       sends confirmation emails, and cleans up expired sessions.
 *       **This endpoint should not be called manually.**
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [data, signature]
 *             properties:
 *               data:
 *                 type: string
 *                 description: Base64-encoded JSON payment data from LiqPay
 *               signature:
 *                 type: string
 *                 description: HMAC-SHA1 signature
 *     responses:
 *       200:
 *         description: Callback processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: Invalid signature
 */
router.post(
  '/liqpay-callback',
  checkCallbackSignature,
  async (req, res, next) => {
    // Captured as we go so the failure alert/log below can identify the paid
    // order even when the error is thrown mid-way through processing.
    const alertCtx = { transactionId: null, orderId: null, email: null };
    // Only true once the payment is confirmed successful (past getSessionData).
    // LiqPay also calls this callback for FAILED/expired payments; getSessionData
    // rejects those, and we must NOT alert the admin about them — no ticket is
    // owed. The alert is strictly for "paid but ticket delivery failed".
    let paymentSucceeded = false;
    // Set once the PDF + email have actually been sent. Lets the catch alert
    // ONLY on a genuine delivery failure — a later step throwing (e.g.
    // deleteExpiredSessions) can't produce a false "not sent" alert.
    let ticketDelivered = false;
    try {
      await sleep(30000);

      // Parse payment callback data
      const { decodedData, parsedData, signature } = parsePaymentCallbackData(
        req.body
      );
      alertCtx.transactionId = parsedData?.transaction_id ?? null;

      // Get session data (throws for non-success payment status)
      const { sessionInfoData, order_id } = await getSessionData(parsedData);
      alertCtx.orderId = order_id ?? null;
      const {
        email,
        passengersInfo,
        selectedBusFlight,
        children: numOfChildren,
        adults: numOfAdults,
        originId,
        destinationId,
        startDate,
        endDate
      } = sessionInfoData;
      alertCtx.email = email ?? null;
      // Payment is confirmed successful from here on.
      paymentSucceeded = true;

      // Prepare passenger data for email
      const passangersData = preparePassengerDataForEmail(passengersInfo);

      // Get or create ticket
      const ticket = await getOrCreateTicket({
        transactionId: parsedData?.transaction_id,
        signature,
        selectedBusFlight,
        numOfChildren,
        numOfAdults,
        originId,
        destinationId,
        startDate,
        endDate,
        passengersInfo,
        decodedData,
        createTicketFn: createTicket
      });

      // Ensure PDF exists and send email
      await ensureTicketPDFAndSendEmail({
        ticket,
        signature,
        email,
        passangersData,
        selectedBusFlight,
        transactionId: ticket?.transactionId,
        orderId: order_id,
        getTicketSubjectFn: getTicketSubject
      });
      // PDF + email confirmed sent — anything failing after this is not a
      // delivery failure and must not alert.
      ticketDelivered = true;

      // Cleanup expired sessions
      await deleteExpiredSessions();

      return res.json({ status: 'ok' });
    } catch (err) {
      if (paymentSucceeded && !ticketDelivered) {
        // Payment was captured but ticket delivery (ticket creation, PDF render,
        // or email) never completed — the case worth alerting on. Every failure
        // is logged; the admin is emailed only once per transaction so LiqPay's
        // many retries of the same order can't flood the inbox.
        const alreadyAlerted = markAndCheckAlerted(alertCtx.transactionId);
        logger.logError(err, {
          scope: 'liqpay-callback',
          ...alertCtx,
          alreadyAlerted
        });
        if (!alreadyAlerted) {
          // Best-effort: never let alerting mask the original error.
          sendAdminAlertMail({
            subject: `⚠️ Квиток не надіслано — платіж ${alertCtx.transactionId}`,
            text:
              `Платіж пройшов, але доставка квитка не вдалася.\n\n` +
              `transaction_id: ${alertCtx.transactionId}\n` +
              `order_id: ${alertCtx.orderId ?? '—'}\n` +
              `email: ${alertCtx.email ?? '—'}\n\n` +
              `Помилка: ${err?.message ?? err}\n\n` +
              `Перегенеруйте PDF і надішліть квиток вручну через адмін-панель.`
          }).catch((alertErr) =>
            logger.error(
              `[ALERT] failed to send failure alert: ${alertErr.message}`
            )
          );
        }
      } else {
        // Not an undelivered-ticket failure: either a failed/expired LiqPay
        // callback (status !== 'success', payment not confirmed) or a post-
        // delivery step throwing after the ticket was already sent. Neither
        // warrants an admin alert — just record it.
        logger.logPayment('liqpay-callback error (no alert)', {
          transactionId: alertCtx.transactionId,
          paymentSucceeded,
          ticketDelivered,
          reason: err?.message
        });
      }
      return next(err);
    }
  }
);

module.exports = router;
