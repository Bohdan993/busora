const { Router } = require('express');
const router = Router();
const { Op } = require('sequelize');
const {
  language: Language,
  discount: Discount,
  discountattributes: DiscountAttributes
} = require('@database/models/index');
const { loadLanguageFile } = require('@helpers');
const {
  mapDiscounts,
  filterByDateDiscounts,
  toPassengerFormDiscounts
} = require('@services/discountService');
const {
  validatePassengersData,
  transformPassengersData
} = require('@services/passengerService');
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');
const {
  checkIfBusFlightSelected
} = require('@middlewares/busFlightMiddlewares');
const constants = require('@helpers/constants.js');
const APIError = require('@exeptions/api-error');

/**
 * @swagger
 * /api/passengers:
 *   get:
 *     summary: Data for the passenger form
 *     description: >
 *       Passenger counts, the price per passenger, the personal discounts that
 *       can be chosen (names in languageCode) and any details entered earlier.
 *     tags: [Passengers]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *     responses:
 *       200:
 *         description: Passenger form data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PassengerFormResponse'
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
      let discounts = [];

      const { languageCode = 'uk_UA' } = req?.query ?? {};

      const {
        adults = 1,
        children = 0,
        selectedBusFlight,
        currency,
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

        return res.json({
          status: 'ok',
          data: {
            adults: Number(adults),
            children: Number(children),
            ticketPrice: Number(selectedBusFlight.purePrice),
            currency: { abbr: currency?.abbr, symbol: currency?.symbol },
            // Personal discounts don't stack with a discounted (promo) flight
            showDiscounts: !selectedBusFlight.hasDiscount,
            discounts: toPassengerFormDiscounts(discounts),
            // What was entered before, so going back keeps the form filled
            passengersInfo: passengersInfo ?? null
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
 * /api/passengers/validate:
 *   post:
 *     summary: Validate passenger details and save them to the booking
 *     description: >
 *       Phones must be Ukrainian (+380) or Czech (+420). The first adult's
 *       email receives the tickets. Must succeed before POST /api/payment.
 *     tags: [Passengers]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidatePassengersRequest'
 *     responses:
 *       200:
 *         description: Details valid and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionOkResponse'
 *       401:
 *         description: SESSION_NOT_STARTED (no or expired booking session) or FLIGHT_NOT_SELECTED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: VALIDATION_FAILED; errors maps each invalid field to messages in languageCode
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
