/** @format */

const { Router } = require('express');
const router = Router();
const { calculatePrice } = require('@services/paymentService');
const { sleep, loadLanguageFile } = require('@helpers');
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');
const {
  checkIfBusFlightSelected
} = require('@middlewares/busFlightMiddlewares');
const {
  checkIfPassengersInfoExists
} = require('@middlewares/passengersMiddleware');
const constants = require('@helpers/constants.js');
const { HOME_CURRENCY, getPaymentLanguage } = require('@root/config/market');
const { session: Session, ticket: Ticket } = require('@database/models/index');
const { checkCallbackSignature } = require('@middlewares/paymentMiddlewares');
const { getTicketSubject } = require('@services/mailService');
const { deriveOrderKeys } = require('@services/sessionService');
const { getPaymentProvider } = require('@services/payments');
const { getExchangeRate } = require('@services/exchangeRates');
const { decodePayload } = require('@services/payments/signedPayload');
const { processPaymentCallback } = require('@services/paymentCallbackService');
const APIError = require('@exeptions/api-error');

// LiqPay may call back before the frontend has finished its own ticket
// request; waiting avoids racing it for the same transaction.
const LIQPAY_CALLBACK_DELAY_MS = 30000;
const MOCK_OUTCOMES = new Set(['success', 'failure']);

/**
 * @swagger
 * /api/payment:
 *   post:
 *     summary: Start checkout for the current booking
 *     description: >
 *       Calculates the price, saves the booking session to the DB and returns a
 *       checkout signed by the configured payment provider. Requires a complete
 *       session: started → flight selected → passengers validated.
 *       With `provider: liqpay`, open the LiqPay widget with `data`/`signature`.
 *       With `provider: mock`, show a fake payment page and finish it with
 *       `POST /api/payment/mock/complete`.
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *     responses:
 *       200:
 *         description: Signed checkout
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
 *                     provider:
 *                       type: string
 *                       enum: [mock, liqpay]
 *                     data:
 *                       type: string
 *                       description: Base64-encoded JSON checkout
 *                     signature:
 *                       type: string
 *                     amount:
 *                       type: integer
 *                       description: Amount charged, in UAH
 *                     currency:
 *                       type: string
 *                       example: UAH
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

      const { currency, passengersInfo, selectedBusFlight, email } =
        req.session;

      // The charged amount is computed here from server-set session data and a
      // freshly resolved rate — never from a rate stored where a client could
      // have influenced it.
      const price = calculatePrice({ data: passengersInfo });
      const currencyExchangeRate = await getExchangeRate(currency?.abbr);
      const currDate = Date.now();
      const ticketPrice = Math.round(
        Number(price) * Number(currencyExchangeRate)
      );

      const firstPassenger = Object.values(passengersInfo)[0];

      const info = JSON.stringify({
        originalCurrency: currency?.abbr,
        originalPrice: price,
        languageCode: languageCode,
        date: currDate
      });
      const { orderId, sessionSignature } = deriveOrderKeys(info);
      const mailTranslations = loadLanguageFile('_mail.js', languageCode);

      const provider = getPaymentProvider();
      const checkout = provider.createCheckout({
        orderId,
        amount: ticketPrice,
        currency: HOME_CURRENCY,
        description: `${mailTranslations.paymentDescriptionText} ${getTicketSubject(selectedBusFlight, languageCode)}`,
        language: getPaymentLanguage(languageCode),
        info,
        senderFirstName: `(${firstPassenger['phone-1']}) ${firstPassenger['name-1']}`,
        senderLastName: `(${email}) ${firstPassenger['last-name-1']}`
      });

      await Session.create({
        sessionInfo: JSON.stringify(req.session),
        expires: Date.now() + constants.SESSION_TIME * 2,
        signature: sessionSignature
      });

      return req.session.save(function (err) {
        if (err) return next(err);

        return res.json({
          status: 'ok',
          data: {
            provider: provider.name,
            data: checkout.data,
            signature: checkout.signature,
            amount: ticketPrice,
            currency: HOME_CURRENCY,
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
 * /api/payment/mock/complete:
 *   post:
 *     summary: Finish a mock checkout (demo payments only)
 *     description: >
 *       Available only when PAYMENT_PROVIDER is `mock`. Simulates the payment
 *       result for a checkout from `POST /api/payment`. On success the ticket,
 *       per-passenger PDFs and email are produced exactly as for a real
 *       payment. Completing the same checkout again does not create a second
 *       ticket. The returned `data`/`signature` work with
 *       `/api/tickets/generate` and `/api/tickets/download-pdf`.
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, signature, outcome]
 *             properties:
 *               data:
 *                 type: string
 *                 description: Checkout `data` from `POST /api/payment`
 *               signature:
 *                 type: string
 *                 description: Checkout `signature` from `POST /api/payment`
 *               outcome:
 *                 type: string
 *                 enum: [success, failure]
 *     responses:
 *       200:
 *         description: Payment result with its signed callback payload
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
 *                     outcome:
 *                       type: string
 *                       enum: [success, failure]
 *                     data:
 *                       type: string
 *                     signature:
 *                       type: string
 *       400:
 *         description: Invalid signature or outcome
 *       404:
 *         description: The mock provider is not enabled
 */
router.post('/mock/complete', async (req, res, next) => {
  try {
    const provider = getPaymentProvider();
    if (provider.name !== 'mock') {
      throw APIError.NotFoundError('not found');
    }

    const { data, signature, outcome } = req?.body ?? {};
    if (!provider.verify({ data, signature })) {
      throw APIError.BadRequestError('invalid signature');
    }
    if (!MOCK_OUTCOMES.has(outcome)) {
      throw APIError.BadRequestError('outcome must be "success" or "failure"');
    }

    const callback = provider.completeCheckout({ data, signature }, outcome);

    if (outcome === 'success') {
      // A repeated completion of the same checkout must not deliver the
      // ticket (PDFs + email) a second time.
      const { transaction_id: transactionId } = decodePayload(callback.data);
      const existingTicket = await Ticket.findOne({
        attributes: ['id'],
        where: { transactionId }
      });
      if (!existingTicket) await processPaymentCallback(callback);
    }

    return res.json({
      status: 'ok',
      data: { outcome, data: callback.data, signature: callback.signature }
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/payment/liqpay-callback:
 *   post:
 *     summary: LiqPay server-to-server payment callback
 *     description: >
 *       Webhook called directly by LiqPay servers after payment is processed
 *       (PAYMENT_PROVIDER=liqpay). Verifies the signature, creates/reuses the
 *       ticket, generates PDFs, sends confirmation emails, and cleans up expired
 *       sessions. **This endpoint should not be called manually.**
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
 *                 description: base64(sha1(private_key + data + private_key))
 *     responses:
 *       200:
 *         description: Callback processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid signature or unsuccessful payment
 */
router.post(
  '/liqpay-callback',
  checkCallbackSignature,
  async (req, res, next) => {
    try {
      await sleep(LIQPAY_CALLBACK_DELAY_MS);

      const { data, signature } = req.body;
      await processPaymentCallback({ data, signature });

      return res.json({ status: 'ok' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
