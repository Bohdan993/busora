/** @format */

const { Router } = require('express');
const router = Router();
const { Op } = require('sequelize');
const pug = require('pug');
const path = require('path');
const sequelize = require('@database/models/index').sequelize;
const {
  route: Route,
  busflight: BusFlight,
  busflightprices: BusFlightPrices,
  currency: Currency,
  language: Language,
  placeattributes: PlaceAttributes,
  place: Place,
  cityattributes: CityAttributes,
  city: City,
  discount: Discount
} = require('@database/models/index');
const { isSpecialDate, loadLanguageFile, isValidDate } = require('@helpers');
const { validateDates } = require('@middlewares/busFlightMiddlewares');
const {
  filterBusFlights,
  transformBusFlights,
  getAvailableDates,
  filterBusFlightsWithFreeSeats,
  createEmptyBusFlightLikeObj
} = require('@services/busFlightService');
const { checkIfSessionIsStarted } = require('@middlewares/sessionMiddlewares');

const constants = require('@helpers/constants.js');
const APIError = require('@exeptions/api-error');
const { getExchangeRate } = require('@services/exchangeRates');

/**
 * @swagger
 * /api/bus-flights:
 *   get:
 *     summary: Search for bus flights (main booking search)
 *     description: >
 *       Returns available bus flights for the given route and date(s).
 *       On success the server creates/regenerates a booking session — all subsequent
 *       booking endpoints rely on this session being active.
 *     tags: [Bus Flights]
 *     parameters:
 *       - in: query
 *         name: originId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: Origin city ID
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema: { type: integer, example: 3 }
 *         description: Destination city ID
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date, example: "2026-06-19" }
 *         description: Departure date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, example: "one-way" }
 *         description: Return date or special value (`one-way`, `open-date`)
 *       - in: query
 *         name: adults
 *         schema: { type: integer, default: 1, example: 2 }
 *       - in: query
 *         name: children
 *         schema: { type: integer, default: 0, example: 1 }
 *       - in: query
 *         name: currencyAbbr
 *         schema: { type: string, example: UAH }
 *         description: Pricing currency abbreviation
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [html, json], default: html }
 *         description: "`html` returns rendered ticket-list HTML; `json` returns raw flight data"
 *     responses:
 *       200:
 *         description: Available flights (HTML or JSON depending on mode)
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
 *                       description: Rendered HTML ticket list
 *                     - type: array
 *                       description: Transformed bus-flight objects
 *                 sessionExpiresTime:
 *                   type: integer
 *                   description: Session TTL in milliseconds
 *       404:
 *         description: No flights found or no free seats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', validateDates, async (req, res, next) => {
  try {
    let busFlights = [];
    let cities = [];
    let price = '';

    const {
      languageCode = 'uk_UA',
      mode = 'html',
      startDate = null,
      endDate = null,
      originId = null,
      destinationId = null,
      adults = 1,
      children = 0,
      currencyAbbr = null
    } = req?.query ?? {};

    const lang = await Language.findOne({
      where: {
        code: {
          [Op.eq]: languageCode
        }
      }
    });

    const error404Translations = loadLanguageFile('404-error.js', lang?.code);

    let currency = await Currency.findOne({
      attributes: ['id', 'name', 'abbr', 'symbol'],
      where: {
        abbr: {
          [Op.eq]: currencyAbbr
        }
      }
    });

    currency = currency?.toJSON();
    if (!currency) throw APIError.BadRequestError('Unknown currency');

    let query = {
      attributes: ['id', 'allSeats', 'freeSeats', 'routeId', 'dateOfDeparture'],
      where: {
        freeSeats: {
          [Op.gte]: 1
        }
      },
      include: [
        {
          model: Route,
          include: [
            {
              model: Language,
              attributes: ['name', 'code'],
              where: {
                id: {
                  [Op.in]: [1, lang?.id]
                }
              }
            }
          ]
        },
        {
          model: Discount,
          attributes: ['id', 'coef', 'busflightId', 'group']
        }
      ],
      order: [
        ['dateOfDeparture', 'ASC'],
        ['routeId', 'ASC']
      ]
    };

    if (isSpecialDate(endDate)) {
      query.where.dateOfDeparture = {};
      query.where.dateOfDeparture = isValidDate(new Date(startDate))
        ? startDate
        : null;
    } else {
      query.where.dateOfDeparture = {};
      query.where.dateOfDeparture[Op.or] = [
        isValidDate(new Date(startDate)) ? startDate : null,
        isValidDate(new Date(endDate)) ? endDate : null
      ];
    }

    busFlights = await BusFlight.findAll(query);
    busFlights = busFlights?.map((bf) => bf?.toJSON());

    if (!busFlights?.length) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: error404Translations,
        isShowBtn: true
      });
    }

    const filteredBusFlightsWithFreeSeats = filterBusFlightsWithFreeSeats({
      busFlights,
      numOfPassengers: parseInt(adults) + parseInt(children)
    });

    if (!filteredBusFlightsWithFreeSeats.length) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: loadLanguageFile(
          '_404-error-no-free-seats.js',
          lang?.code
        ),
        isShowBtn: true
      });
    }

    const filteredBusFlights = filterBusFlights({
      busFlights: filteredBusFlightsWithFreeSeats,
      originId,
      destinationId,
      startDate,
      endDate
    });

    if (!filteredBusFlights?.resultFrom?.length) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: error404Translations,
        isShowBtn: true
      });
    }

    let placeIds = [
      ...filteredBusFlights.resultFrom.flatMap((el) =>
        el?.route?.routePath?.onboarding.map((item) => item?.placeId)
      ),
      ...filteredBusFlights.resultFrom.flatMap((el) =>
        el?.route?.routePath?.outboarding.map((item) => item?.placeId)
      )
    ];

    let cityQuery = {
      attributes: ['id'],
      where: {
        id: {
          [Op.or]: [originId, destinationId]
        }
      },
      include: [
        {
          model: CityAttributes,
          as: 'cityattrs',
          attributes: ['name', 'cityId', 'languageId'],
          where: {
            languageId: {
              [Op.in]: [1, lang?.id]
            }
          },
          include: [
            {
              model: Language,
              attributes: ['name', 'code'],
              where: {
                id: {
                  [Op.in]: [1, lang?.id]
                }
              }
            }
          ]
        },
        {
          model: Place,
          attributes: ['id'],
          include: [
            {
              model: PlaceAttributes,
              as: 'placeattrs',
              attributes: ['name', 'placeId', 'languageId'],
              where: {
                languageId: {
                  [Op.in]: [1, lang?.id]
                },
                placeId: {
                  [Op.or]: Array.from(new Set(placeIds))
                }
              },
              include: [
                {
                  model: Language,
                  attributes: ['name', 'code'],
                  where: {
                    id: {
                      [Op.in]: [1, lang?.id]
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    cities = await City.findAll(cityQuery);

    if (!cities?.length || cities?.length !== 2) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: error404Translations,
        isShowBtn: true
      });
    }

    cities = cities?.map((city) => city?.toJSON());

    let priceQuery = {
      attributes: [
        'currencyId',
        'firstCityId',
        'secondCityId',
        'priceOneWay',
        'priceRoundTrip'
      ],
      where: {
        firstCityId: {
          [Op.or]: [originId, destinationId]
        },
        secondCityId: {
          [Op.or]: [originId, destinationId]
        },
        currencyId: currency?.id
      }
    };

    price = await BusFlightPrices.findAll(priceQuery);
    price = price.map((p) => p?.toJSON());

    const transformedBusFlights = transformBusFlights({
      busFlights: filteredBusFlights,
      cities,
      price,
      currency,
      originId,
      destinationId,
      endDate,
      startDate,
      languageCode: lang?.code,
      languageId: lang?.id
    });

    // Resolve before regenerate: an error thrown inside its callback would
    // escape this try/catch and never reach the error handler.
    const currencyExchangeRate = await getExchangeRate(currency?.abbr);

    return req.session.regenerate(async function (err) {
      if (err) return next(err);

      req.session.busFlights = transformedBusFlights;
      req.session.startDate = startDate;
      req.session.endDate = endDate;
      req.session.currency = currency;
      req.session.currencyExchangeRate = currencyExchangeRate;
      req.session.adults = adults;
      req.session.children = children;
      req.session.originId = originId;
      req.session.destinationId = destinationId;
      req.session.selectedBusFlight = transformedBusFlights?.[0];
      req.session.selectedBusFlight &&
        (req.session.selectedBusFlight.isSelected = true);
      req.session.isStarted = true;

      return req.session.save(function (err) {
        if (err) return next(err);

        if (mode?.toLowerCase() === 'json') {
          return res.json({
            status: 'ok',
            data: transformedBusFlights,
            sessionExpiresTime: constants.SESSION_TIME
          });
        }

        if (mode?.toLowerCase() === 'html' || !mode) {
          const template = path.resolve('views', 'ticket-list.pug');
          const html = pug.renderFile(template, {
            flightsData: transformedBusFlights,
            translations: loadLanguageFile('ticket-list.js', lang?.code)
          });

          return res.json({
            status: 'ok',
            data: html,
            sessionExpiresTime: constants.SESSION_TIME
          });
        }
      });
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/bus-flights/alternatives:
 *   get:
 *     summary: Get alternative bus flights for a route
 *     description: Returns nearby-date alternatives when no exact-date flight is available. Requires an active session.
 *     tags: [Bus Flights]
 *     parameters:
 *       - in: query
 *         name: originId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Reference date — alternatives on or after this date are returned
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: adults
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: children
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [forwards, backwards], default: forwards }
 *         description: "`forwards` for outbound leg, `backwards` for return leg"
 *       - in: query
 *         name: currencyAbbr
 *         schema: { type: string }
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [html, json], default: html }
 *     responses:
 *       200:
 *         description: Alternative flights grouped by departure date
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
 *                       description: Rendered HTML
 *                     - type: array
 *                 sessionExpiresTime:
 *                   type: integer
 *       404:
 *         description: No alternatives found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/alternatives', validateDates, async (req, res, next) => {
  try {
    let busFlights = [];
    let cities = [];
    let price = '';

    const {
      languageCode = 'uk_UA',
      mode = 'html',
      startDate = null,
      endDate = null,
      originId = null,
      destinationId = null,
      adults = 1,
      children = 0,
      direction = constants.FORWARDS,
      currencyAbbr = null
    } = req?.query ?? {};

    const lang = await Language.findOne({
      where: {
        code: {
          [Op.eq]: languageCode
        }
      }
    });

    let currency = req.session?.currency;

    if (!currency) {
      currency = await Currency.findOne({
        attributes: ['id', 'name', 'abbr', 'symbol'],
        where: {
          abbr: {
            [Op.eq]: currencyAbbr
          }
        }
      });

      currency = currency?.toJSON();
    }
    if (!currency) throw APIError.BadRequestError('Unknown currency');

    const error404Translations = loadLanguageFile(
      '_404-error-no-alternative-tickets.js',
      lang?.code
    );

    const limit = constants.LIMIT_OF_ALTERNATIVE_BUS_FLIGHTS;

    let query = {
      attributes: ['id', 'allSeats', 'freeSeats', 'routeId', 'dateOfDeparture'],
      where: {
        dateOfDeparture: {
          [Op.gt]: new Date(startDate)
        },
        freeSeats: {
          [Op.gte]: 1
        }
      },
      include: [
        {
          model: Route,
          include: [
            {
              model: Language,
              attributes: ['id', 'name', 'code'],
              where: {
                id: {
                  [Op.in]: [1, lang?.id]
                }
              }
            }
          ],
          where: {
            [Op.and]: [
              sequelize.literal(
                `JSON_CONTAINS(route.routePath, '{"cityId": ${originId}}', '$.onboarding') = 1`
              ),
              sequelize.literal(
                `JSON_CONTAINS(route.routePath, '{"cityId": ${destinationId}}', '$.outboarding') = 1`
              )
            ]
          }
        },
        {
          model: Discount,
          attributes: ['id', 'coef', 'busflightId', 'group']
        }
      ],
      order: [
        ['dateOfDeparture', 'ASC'],
        ['routeId', 'ASC']
      ],
      limit
    };

    busFlights = await BusFlight.findAll(query);
    busFlights = busFlights?.map((bf) => bf?.toJSON());

    if (!busFlights?.length) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: error404Translations,
        isShowBtn: false
      });
    }

    const filteredBusFlightsWithFreeSeats = filterBusFlightsWithFreeSeats({
      busFlights,
      numOfPassengers: parseInt(adults) + parseInt(children)
    });

    if (!filteredBusFlightsWithFreeSeats.length) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: loadLanguageFile(
          '_404-error-no-alternative-tickets-free-seats.js',
          lang?.code
        ),
        isShowBtn: false
      });
    }

    const filteredBusFlights = filterBusFlights({
      busFlights: filteredBusFlightsWithFreeSeats,
      originId,
      destinationId,
      startDate,
      endDate,
      isAlternativeBusFlights: true
    });

    if (!filteredBusFlights?.resultFrom?.length) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: error404Translations,
        isShowBtn: false
      });
    }

    let placeIds = [
      ...filteredBusFlights.resultFrom.flatMap((el) =>
        el?.route?.routePath?.onboarding.map((item) => item?.placeId)
      ),
      ...filteredBusFlights.resultFrom.flatMap((el) =>
        el?.route?.routePath?.outboarding.map((item) => item?.placeId)
      )
    ];

    let cityQuery = {
      attributes: ['id'],
      where: {
        id: {
          [Op.or]: [originId, destinationId]
        }
      },
      include: [
        {
          model: CityAttributes,
          as: 'cityattrs',
          attributes: ['name', 'cityId', 'languageId'],
          where: {
            languageId: {
              [Op.in]: [1, lang?.id]
            }
          },
          include: [
            {
              model: Language,
              attributes: ['name', 'code'],
              where: {
                id: {
                  [Op.in]: [1, lang?.id]
                }
              }
            }
          ]
        },
        {
          model: Place,
          attributes: ['id'],
          include: [
            {
              model: PlaceAttributes,
              as: 'placeattrs',
              attributes: ['name', 'placeId', 'languageId'],
              where: {
                languageId: {
                  [Op.in]: [1, lang?.id]
                },
                placeId: {
                  [Op.or]: Array.from(new Set(placeIds))
                }
              },
              include: [
                {
                  model: Language,
                  attributes: ['name', 'code'],
                  where: {
                    id: {
                      [Op.in]: [1, lang?.id]
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    cities = await City.findAll(cityQuery);

    if (!cities?.length || cities?.length !== 2) {
      throw APIError.NotFoundError('not found', 'error-404', {
        translations: error404Translations,
        isShowBtn: false
      });
    }

    cities = cities?.map((city) => city?.toJSON());

    let priceQuery = {
      attributes: [
        'currencyId',
        'firstCityId',
        'secondCityId',
        'priceOneWay',
        'priceRoundTrip'
      ],
      where: {
        firstCityId: {
          [Op.or]: [originId, destinationId]
        },
        secondCityId: {
          [Op.or]: [originId, destinationId]
        },
        currencyId: currency?.id || 1
      }
    };

    price = await BusFlightPrices.findAll(priceQuery);
    price = price.map((p) => p?.toJSON());

    let transformedBusFlights = transformBusFlights({
      busFlights: filteredBusFlights,
      cities,
      price,
      currency,
      originId,
      destinationId,
      endDate,
      startDate,
      languageCode: lang?.code,
      languageId: lang?.id,
      isAlternativeBusFlights: true,
      direction
    });

    transformedBusFlights = transformedBusFlights.reduce((acc, curr) => {
      if (!acc[curr?.dates?.departure]) {
        acc[curr?.dates?.departure] = [curr];
      } else {
        acc[curr?.dates?.departure].push(curr);
      }

      return acc;
    }, {});

    transformedBusFlights = Object.entries(transformedBusFlights);

    function saveSessionCb(err) {
      if (err) return next(err);

      if (mode?.toLowerCase() === 'json') {
        return res.json({
          status: 'ok',
          data: transformedBusFlights,
          sessionExpiresTime: constants.SESSION_TIME
        });
      }

      if (mode?.toLowerCase() === 'html' || !mode) {
        const template = path.resolve('views', 'alternative-tickets.pug');
        const html = pug.renderFile(template, {
          isForwards: direction === constants.FORWARDS,
          cityFrom: cities
            ?.filter((city) =>
              city?.cityattrs.find(
                (el) => String(el?.cityId) === String(originId)
              )
            )?.[0]
            ?.cityattrs?.find((el) => el?.language?.code === languageCode)
            ?.name,
          cityTo: cities
            ?.filter((city) =>
              city?.cityattrs.find(
                (el) => String(el?.cityId) === String(destinationId)
              )
            )?.[0]
            ?.cityattrs?.find((el) => el?.language?.code === languageCode)
            ?.name,
          flightsData: transformedBusFlights,
          translations: loadLanguageFile('ticket-list.js', lang?.code)
        });

        return res.json({
          status: 'ok',
          data: html,
          sessionExpiresTime: constants.SESSION_TIME
        });
      }
    }

    if (
      !req.session?.selectedBusFlight?.isSelected &&
      direction === constants.FORWARDS
    ) {
      // Resolve before regenerate (see the search route above).
      const currencyExchangeRate = await getExchangeRate(currency?.abbr);

      return req.session.regenerate(async function (err) {
        if (err) return next(err);

        // This branch only runs for the forward direction, so the outbound
        // alternatives are always what we store here.
        req.session.alternativeBusFlightsFrom = transformedBusFlights;

        req.session.busFlights = [];
        req.session.startDate = startDate;
        req.session.endDate = endDate;
        req.session.currency = currency;
        req.session.currencyExchangeRate = currencyExchangeRate;
        req.session.adults = adults;
        req.session.children = children;
        req.session.originId = originId;
        req.session.destinationId = destinationId;
        req.session.isStarted = true;

        return req.session.save(saveSessionCb);
      });
    }

    // Forward results (or the first set, before any outbound is stored) fill
    // the outbound alternatives; otherwise this is the return leg.
    if (
      !req.session.alternativeBusFlightsFrom ||
      direction === constants.FORWARDS
    ) {
      req.session.alternativeBusFlightsFrom = transformedBusFlights;
    } else {
      req.session.alternativeBusFlightsTo = transformedBusFlights;
    }

    return req.session.save(saveSessionCb);
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/bus-flights/available-dates:
 *   get:
 *     summary: Get available departure dates for the calendar
 *     description: >
 *       Returns dates that have at least one flight with free seats for the given
 *       origin/destination pair. Used by the booking calendar to highlight bookable dates.
 *     tags: [Bus Flights]
 *     parameters:
 *       - in: query
 *         name: originId
 *         schema: { type: integer }
 *       - in: query
 *         name: destinationId
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Only return dates on or after this date (defaults to today)
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [forwards, backwards], default: forwards }
 *     responses:
 *       200:
 *         description: Array of available dates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: date
 *                   example: ["2026-06-19", "2026-06-26"]
 */
router.get('/available-dates', async (req, res, next) => {
  try {
    const {
      originId = null,
      destinationId = null,
      startDate = null,
      direction = constants.FORWARDS
    } = req?.query ?? {};

    const data = await getAvailableDates({
      originId,
      destinationId,
      startDate,
      direction
    });

    return res.json({
      status: 'ok',
      data
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/bus-flights/select:
 *   post:
 *     summary: Select a bus flight for the active booking session
 *     description: >
 *       Stores the chosen flight in the session. Must be called after a successful
 *       search (`GET /api/bus-flights`). `isMain=true` selects from the main search
 *       results; `isMain=false` selects from the alternatives list.
 *     tags: [Bus Flights]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:
 *                 type: string
 *                 description: Bus-flight ID to select
 *                 example: "2165"
 *               isMain:
 *                 type: boolean
 *                 default: true
 *                 description: Select from main results (true) or alternatives (false)
 *               direction:
 *                 type: string
 *                 enum: [forwards, backwards]
 *                 default: forwards
 *                 description: Which leg is being selected (alternatives only)
 *     responses:
 *       200:
 *         description: Flight selected and stored in session
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
 *         description: Invalid flight ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Session not started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/select', [checkIfSessionIsStarted], async (req, res, next) => {
  try {
    const {
      id,
      isMain = true,
      direction = constants.FORWARDS
    } = req?.body ?? {};

    let selectedBusFlight = null;

    if (isMain) {
      selectedBusFlight = req.session?.busFlights?.find((el) => {
        return String(el?.id) === String(id);
      });

      if (!selectedBusFlight) {
        throw APIError.BadRequestError('Invalid request');
      }

      if (!selectedBusFlight.isSelected) {
        selectedBusFlight.isSelected = true;
      }
    } else {
      switch (direction) {
        case constants.FORWARDS: {
          const selectedBF = req.session?.alternativeBusFlightsFrom
            ?.find((el) => {
              return el?.[1].find((elem) => {
                return String(elem?.id) === String(id);
              });
            })?.[1]
            .find((el) => {
              return String(el?.id) === String(id);
            });

          selectedBusFlight = selectedBF;

          if (!selectedBusFlight) {
            throw APIError.BadRequestError('Invalid request');
          }

          if (selectedBusFlight?.type !== constants.ROUND) {
            selectedBusFlight.isSelected = true;
          }

          break;
        }

        case constants.BACKWARDS: {
          const selectedBF = req.session?.alternativeBusFlightsTo
            ?.find((el) => {
              return el?.[1].find((elem) => {
                return String(elem?.id) === String(id);
              });
            })?.[1]
            .find((el) => {
              return String(el?.id) === String(id);
            });

          if (!selectedBF) {
            throw APIError.BadRequestError('Invalid request');
          }

          selectedBusFlight = req.session.selectedBusFlight?.id?.includes(
            'alternative-ticket-from'
          )
            ? req.session.selectedBusFlight
            : createEmptyBusFlightLikeObj();
          selectedBusFlight.isSelected = selectedBusFlight?.id?.includes(
            'alternative-ticket-from'
          )
            ? true
            : false;
          selectedBusFlight.busFlightToId = selectedBF.busFlightFromId;
          selectedBusFlight.places.to.routeId = selectedBF.places.from.routeId;
          selectedBusFlight.places.to.onBoardingPlace =
            selectedBF.places.from.onBoardingPlace;
          selectedBusFlight.places.to.onBoardingPlaceUkr =
            selectedBF.places.from.onBoardingPlaceUkr;
          selectedBusFlight.places.to.outBoardingPlace =
            selectedBF.places.from.outBoardingPlace;
          selectedBusFlight.places.to.outBoardingPlaceUkr =
            selectedBF.places.from.outBoardingPlaceUkr;
          selectedBusFlight.places.to.routeName =
            selectedBF.places.from.routeName;
          selectedBusFlight.places.to.routeNameUkr =
            selectedBF.places.from.routeNameUkr;
          selectedBusFlight.places.to.onBoardingTime =
            selectedBF.places.from.onBoardingTime;
          selectedBusFlight.places.to.outBoardingTime =
            selectedBF.places.from.outBoardingTime;
          selectedBusFlight.dates.return = selectedBF.dates.departure;
          selectedBusFlight.dates.returnUkr = selectedBF.dates.departureUkr;
          selectedBusFlight.dates.returnPure = selectedBF.dates.departurePure;
          selectedBusFlight.purePriceFull = String(
            Math.round(selectedBusFlight.purePriceFull) +
              Math.round(selectedBF.purePriceFull)
          );
          selectedBusFlight.priceFull =
            selectedBusFlight.purePriceFull +
            selectedBF.priceFull.replace(/^\d+/gm, '');
          selectedBusFlight.purePrice = String(
            Math.round(selectedBusFlight.purePrice) +
              Math.round(selectedBF.purePrice)
          );
          selectedBusFlight.price =
            selectedBusFlight.purePrice +
            selectedBF.price.replace(/^\d+/gm, '');
          selectedBusFlight.hasDiscount =
            selectedBusFlight.hasDiscount || selectedBF.hasDiscount;
          selectedBusFlight.discountPercentage = Number(
            Number(
              ((selectedBusFlight.purePriceFull - selectedBusFlight.purePrice) /
                selectedBusFlight.purePriceFull) *
                100
            ).toFixed(1)
          );

          break;
        }

        default: {
          throw new Error('Unreachable busflight direction!');
        }
      }
    }

    if (!selectedBusFlight) {
      throw APIError.BadRequestError('Invalid request');
    }

    req.session.selectedBusFlight = selectedBusFlight;
    req.session.startDate = selectedBusFlight.dates.departurePure;
    req.session.endDate = selectedBusFlight.dates.returnPure;

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

module.exports = router;
