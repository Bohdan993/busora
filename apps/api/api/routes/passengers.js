const { Router } = require('express');
const router = Router();
const { Op } = require('sequelize');
const pug = require('pug');
const path = require('path');
const {
  language: Language,
  discount: Discount,
  discountattributes: DiscountAttributes
} = require('@database/models/index');
const { loadLanguageFile, transformTimestampToDate } = require('@helpers');
const {
  mapDiscounts,
  filterByDateDiscounts
} = require('@services/discountService');
const {
  validatePassengersData,
  transformPassengersData
} = require('@services/passengerService');
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');
const {
  checkIfBusFlightSelected
} = require('@middlewares/busFlightMiddlewares');
const {
  checkIfPassengersInfoExists
} = require('@middlewares/passengersMiddleware');
const constants = require('@helpers/constants.js');
const APIError = require('@exeptions/api-error');

/**
 * @swagger
 * /api/passengers:
 *   get:
 *     summary: Get passenger form data for the active booking
 *     description: >
 *       Returns available discounts and renders (or returns) the passenger
 *       details form. Requires an active session with a selected flight.
 *     tags: [Passengers]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [html, json], default: html }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [standart, check], default: standart }
 *         description: "`check` renders the info-check form; `standart` renders the main passenger form"
 *     responses:
 *       200:
 *         description: Passenger form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   oneOf:
 *                     - type: string
 *                       description: Rendered HTML form
 *                     - type: object
 *                       properties:
 *                         adults: { type: integer }
 *                         children: { type: integer }
 *                         discounts:
 *                           type: array
 *                           items: { type: object }
 *                 sessionExpiresTime:
 *                   type: integer
 *       401:
 *         description: Session not started or flight not selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  [
    checkIfSessionIsStarted,
    checkIfBusFlightSelected,
    checkIfPassengersInfoExists
  ],
  async (req, res, next) => {
    try {
      let discounts = [];

      const {
        languageCode = 'uk_UA',
        mode = 'html',
        type = 'standart'
      } = req?.query ?? {};

      const {
        adults = 1,
        children = 0,
        selectedBusFlight,
        passengersInfo
      } = req.session;

      const lang = await Language.findOne({
        where: {
          code: {
            [Op.eq]: languageCode
          }
        }
      });

      discounts = await Discount.findAll({
        attributes: [
          'id',
          'coef',
          'inactivePeriod',
          'group',
          'maxAge',
          'minAge'
        ],
        where: {
          group: {
            [Op.not]: constants.BUS_FLIGHT
          }
        },
        include: [
          {
            model: DiscountAttributes,
            as: 'discountattrs',
            attributes: ['name', 'languageId'],
            where: {
              languageId: {
                [Op.eq]: lang?.id
              }
            }
          }
        ],
        order: [['order', 'ASC']]
      });

      discounts = discounts?.map((discount) => discount?.toJSON());
      discounts = mapDiscounts(discounts);
      discounts = filterByDateDiscounts(discounts);

      req.session.busFlights = null;
      req.session.alternativeBusFlightsFrom = null;
      req.session.alternativeBusFlightsTo = null;

      return req.session.save(function (err) {
        if (err) return next(err);
        if (mode?.toLowerCase() === 'json') {
          return res.json({
            status: 'ok',
            data: { adults, children, discounts },
            sessionExpiresTime: constants.SESSION_TIME
          });
        }

        if (mode?.toLowerCase() === 'html' || !mode) {
          const template = path.resolve(
            'views',
            type === 'check' ? 'info-check-form.pug' : 'passengers-form.pug'
          );
          const html = pug.renderFile(template, {
            adults,
            children,
            discounts,
            constants,
            translations: loadLanguageFile('passengers-form.js', lang?.code),
            ticketPrice: selectedBusFlight.purePrice,
            passengersInfo: passengersInfo
              ? Object.entries(passengersInfo)
              : null,
            transformTimestampToDate,
            showDiscounts: !selectedBusFlight.hasDiscount
          });

          return res.json({
            status: 'ok',
            data: html,
            sessionExpiresTime: constants.SESSION_TIME
          });
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/passengers/validate:
 *   post:
 *     summary: Validate and save passenger data to the session
 *     description: >
 *       Validates the submitted passenger form data and stores it in the session.
 *       Must be called before `POST /api/payment`.
 *     tags: [Passengers]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [passengersData]
 *             properties:
 *               passengersData:
 *                 type: object
 *                 description: >
 *                   Key-value map of passenger data. Each key is a passenger block
 *                   ID (e.g. `adult-passenger-1`); the value is an object with
 *                   fields like `name-1`, `last-name-1`, `phone-1`, `date-of-birth-1`,
 *                   `email-1`, `discount-1`.
 *                 example:
 *                   adult-passenger-1:
 *                     name-1: Ivan
 *                     last-name-1: Petrenko
 *                     phone-1: "+380671234567"
 *                     date-of-birth-1: "20-03-1985"
 *                     email-1: ivan@example.com
 *     responses:
 *       200:
 *         description: Passenger data valid and saved to session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 sessionExpiresTime:
 *                   type: integer
 *       400:
 *         description: Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Session not started or flight not selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/validate',
  [checkIfSessionIsStarted, checkIfBusFlightSelected],
  async (req, res, next) => {
    try {
      const { languageCode = 'uk_UA' } = req?.query ?? {};

      const { passengersData } = req?.body ?? {};

      const { startDate, selectedBusFlight } = req?.session ?? {};

      const lang = await Language.findOne({
        where: {
          code: {
            [Op.eq]: languageCode
          }
        }
      });

      const passengerTranslations = loadLanguageFile(
        'passengers-form.js',
        lang?.code
      );
      const validData = await validatePassengersData(
        passengersData,
        passengerTranslations,
        startDate
      );

      if (validData.status === 'error') {
        throw APIError.ValidationError('validation error', validData.data);
      }

      const ticketPrice = selectedBusFlight.purePrice;
      const transformedPassengersData = await transformPassengersData(
        validData.data,
        ticketPrice,
        lang?.id
      );

      req.session.passengersInfo = transformedPassengersData;
      req.session.email = Object.values(transformedPassengersData).find(
        (_, ind) => ind === 0
      )?.['email-1'];
      // req.session.flag = !req.session.flag;
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
  }
);

module.exports = router;
