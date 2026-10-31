/** @format */

const { Router } = require('express');
const router = Router();
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');
const { decodeHTMLEntities } = require('@helpers');
const { calculatePrice } = require('@services/paymentService');
const { applyClientSessionUpdate } = require('@services/sessionService');
const {
  checkIfBusFlightSelected
} = require('@middlewares/busFlightMiddlewares');
const constants = require('@helpers/constants.js');

/**
 * @swagger
 * /api/current-data:
 *   get:
 *     summary: Booking summary for the review step
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: Current booking
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurrentDataResponse'
 *       401:
 *         description: SESSION_NOT_STARTED (no or expired booking session) or FLIGHT_NOT_SELECTED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  [checkIfSessionIsStarted, checkIfBusFlightSelected],
  async (req, res, next) => {
    try {
      const {
        adults,
        children,
        selectedBusFlight: { purePrice },
        startDate,
        endDate,
        bookingPageParams,
        currency: { symbol: currencySymbol },
        passengersInfo
      } = req?.session ?? {};

      let price =
        calculatePrice({ data: passengersInfo }) ||
        Math.round(
          parseInt(purePrice) * (parseInt(adults) + parseInt(children))
        );

      const data = {
        adults: Number(adults),
        children: Number(children),
        price,
        startDate,
        endDate,
        bookingPageParams,
        currencySymbol
      };

      for (const key in data) {
        if (typeof data[key] === 'string') {
          data[key] = decodeHTMLEntities(data[key]);
        }
      }

      return req.session.save(function (err) {
        if (err) return next(err);

        return res.json({
          status: 'ok',
          data,
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
 * /api/current-data:
 *   post:
 *     summary: Save client state in the booking session
 *     description: >
 *       Stores bookingPageParams so the client can restore its booking page.
 *       Any other key, or a non-string value, is rejected with 400 — prices,
 *       rates and passenger data are only ever set by the server.
 *     tags: [Session]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SessionUpdateRequest'
 *     responses:
 *       200:
 *         description: Saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionOkResponse'
 *       400:
 *         description: BAD_REQUEST — a key other than bookingPageParams
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: SESSION_NOT_STARTED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', [checkIfSessionIsStarted], async (req, res, next) => {
  try {
    applyClientSessionUpdate(req.session, req?.body);

    return req.session.save(function (err) {
      if (err) return next(err);

      return res.json({
        status: 'ok',
        sessionExpiresTime: constants.SESSION_TIME
      });
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/current-data/is-started:
 *   get:
 *     summary: Whether a booking session is active
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: Session active
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, active]
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 active:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: SESSION_NOT_STARTED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/is-started', [checkIfSessionIsStarted], async (req, res, next) => {
  try {
    return res.json({
      status: 'ok',
      active: req?.session?.isStarted
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
