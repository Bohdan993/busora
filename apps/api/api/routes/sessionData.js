/** @format */

const { Router } = require('express');
const router = Router();
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');
const { encodeHTMLEntities, decodeHTMLEntities } = require('@helpers');
const { calculatePrice } = require('@services/paymentService');
const {
  checkIfBusFlightSelected
} = require('@middlewares/busFlightMiddlewares');
const constants = require('@helpers/constants.js');

/**
 * @swagger
 * /api/current-data:
 *   get:
 *     summary: Get current booking session data
 *     description: Returns summary data from the active session (passenger count, price, dates).
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: Current session summary
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
 *                     adults: { type: integer }
 *                     children: { type: integer }
 *                     price: { type: number }
 *                     startDate: { type: string, format: date }
 *                     endDate: { type: string }
 *                     bookingPageParams: { type: object }
 *                     currencySymbol: { type: string, example: "₴" }
 *                 sessionExpiresTime:
 *                   type: integer
 *       401:
 *         description: Session not started
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
        adults,
        children,
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
 *     summary: Store arbitrary data in the booking session
 *     description: >
 *       Writes all key-value pairs from the request body into the session
 *       (HTML-entity-encoded). Used by the frontend to persist booking page
 *       query parameters across navigation.
 *     tags: [Session]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties:
 *               type: string
 *             example:
 *               bookingPageParams: "origin=1&destination=3&departure=2026-06-19"
 *     responses:
 *       200:
 *         description: Data saved to session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 sessionExpiresTime:
 *                   type: integer
 *       401:
 *         description: Session not started
 */
router.post('/', [checkIfSessionIsStarted], async (req, res, next) => {
  try {
    for (const key in req?.body) {
      req.session[key] = encodeHTMLEntities(req.body[key]);
    }

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
 *     summary: Check whether the booking session is active
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: Session status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 active:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Session not started
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
