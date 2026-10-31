/** @format */

const { Router } = require('express');
const router = Router();
const { Op } = require('sequelize');
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
const { isSpecialDate, isValidDate } = require('@helpers');
const {
  validateDates,
  validateCityIds
} = require('@middlewares/busFlightMiddlewares');
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
 *     summary: Search bus flights (starts a booking)
 *     description: >
 *       Returns the offers for a route and date. Starts a new booking session
 *       (sets the session cookie) with the first offer pre-selected; the other
 *       booking endpoints work on this session.
 *     tags: [Bus Flights]
 *     parameters:
 *       - in: query
 *         name: originId
 *         required: true
 *         schema: { type: integer, minimum: 1, example: 1 }
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema: { type: integer, minimum: 1, example: 8 }
 *       - in: query
 *         name: adults
 *         schema: { type: integer, minimum: 0, default: 1, example: 2 }
 *       - in: query
 *         name: children
 *         schema: { type: integer, minimum: 0, default: 0, example: 1 }
 *       - in: query
 *         name: currencyAbbr
 *         required: true
 *         schema: { type: string, example: CZK }
 *         description: Currency of the returned prices (UAH or CZK)
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date, example: '2026-11-20' }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, example: one-way }
 *         description: Return date (round trip), or one-way / open-date
 *     responses:
 *       200:
 *         description: Offers, first one selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusFlightsResponse'
 *       400:
 *         description: BAD_REQUEST (ids, unknown currency) or INVALID_DATES
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: NO_FLIGHTS or NO_FREE_SEATS
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: EXCHANGE_RATE_UNAVAILABLE
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Ids first: the alternatives query builds a raw SQL literal from them
const validateSearchQuery = [validateCityIds, validateDates];

router.get('/', validateSearchQuery, async (req, res, next) => {
  try {
    let busFlights = [];
    let cities = [];
    let price = '';

    const {
      languageCode = 'uk_UA',
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
      throw APIError.NotFoundError(
        'no flights found',
        APIError.codes.NO_FLIGHTS
      );
    }

    const filteredBusFlightsWithFreeSeats = filterBusFlightsWithFreeSeats({
      busFlights,
      numOfPassengers: parseInt(adults) + parseInt(children)
    });

    if (!filteredBusFlightsWithFreeSeats.length) {
      throw APIError.NotFoundError(
        'no flight has enough free seats',
        APIError.codes.NO_FREE_SEATS
      );
    }

    const filteredBusFlights = filterBusFlights({
      busFlights: filteredBusFlightsWithFreeSeats,
      originId,
      destinationId,
      startDate,
      endDate
    });

    if (!filteredBusFlights?.resultFrom?.length) {
      throw APIError.NotFoundError(
        'no flights found',
        APIError.codes.NO_FLIGHTS
      );
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
      throw APIError.NotFoundError(
        'no flights found',
        APIError.codes.NO_FLIGHTS
      );
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

        return res.json({
          status: 'ok',
          data: transformedBusFlights,
          sessionExpiresTime: constants.SESSION_TIME
        });
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
 *     summary: Nearest later flights for one direction
 *     description: >
 *       Up to three departure dates after startDate with free seats. For the
 *       outbound direction without a selected flight this starts a new booking
 *       session, like the main search.
 *     tags: [Bus Flights]
 *     parameters:
 *       - in: query
 *         name: originId
 *         required: true
 *         schema: { type: integer, minimum: 1, example: 1 }
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema: { type: integer, minimum: 1, example: 8 }
 *       - in: query
 *         name: adults
 *         schema: { type: integer, minimum: 0, default: 1, example: 2 }
 *       - in: query
 *         name: children
 *         schema: { type: integer, minimum: 0, default: 0, example: 1 }
 *       - in: query
 *         name: currencyAbbr
 *         required: true
 *         schema: { type: string, example: CZK }
 *         description: Currency of the returned prices (UAH or CZK)
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Alternatives depart after this date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, example: one-way }
 *         description: Return date (round trip), or one-way / open-date
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [forwards, backwards], default: forwards }
 *         description: forwards for the outbound leg, backwards for the return leg
 *     responses:
 *       200:
 *         description: Offers grouped by departure date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlternativesResponse'
 *       400:
 *         description: BAD_REQUEST or INVALID_DATES
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: NO_ALTERNATIVES or NO_FREE_SEATS
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: EXCHANGE_RATE_UNAVAILABLE
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/alternatives', validateSearchQuery, async (req, res, next) => {
  try {
    let busFlights = [];
    let cities = [];
    let price = '';

    const {
      languageCode = 'uk_UA',
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
                `JSON_CONTAINS(route.routePath, '{"cityId": ${Number(originId)}}', '$.onboarding') = 1`
              ),
              sequelize.literal(
                `JSON_CONTAINS(route.routePath, '{"cityId": ${Number(destinationId)}}', '$.outboarding') = 1`
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
      throw APIError.NotFoundError(
        'no alternative flights found',
        APIError.codes.NO_ALTERNATIVES
      );
    }

    const filteredBusFlightsWithFreeSeats = filterBusFlightsWithFreeSeats({
      busFlights,
      numOfPassengers: parseInt(adults) + parseInt(children)
    });

    if (!filteredBusFlightsWithFreeSeats.length) {
      throw APIError.NotFoundError(
        'no flight has enough free seats',
        APIError.codes.NO_FREE_SEATS
      );
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
      throw APIError.NotFoundError(
        'no alternative flights found',
        APIError.codes.NO_ALTERNATIVES
      );
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
      throw APIError.NotFoundError(
        'no alternative flights found',
        APIError.codes.NO_ALTERNATIVES
      );
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

      // The session keeps [display date, flights] pairs (read by /select);
      // clients get one object per departure date, keyed by the ISO date.
      return res.json({
        status: 'ok',
        data: transformedBusFlights.map(([, flights]) => ({
          date: flights[0].dates.departurePure,
          flights
        })),
        sessionExpiresTime: constants.SESSION_TIME
      });
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
 *     summary: Bookable departure dates for the calendar
 *     description: Dates with at least one flight with free seats for the city pair.
 *     tags: [Bus Flights]
 *     parameters:
 *       - in: query
 *         name: originId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Only dates on or after this one (defaults to today)
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [forwards, backwards], default: forwards }
 *     responses:
 *       200:
 *         description: ISO dates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvailableDatesResponse'
 *       400:
 *         description: BAD_REQUEST (ids)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/available-dates', validateCityIds, async (req, res, next) => {
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
 *     summary: Select an offer for the booking
 *     description: >
 *       Selects an offer returned by the search or the alternatives in this
 *       session. For a round trip from alternatives, select the outbound offer
 *       (direction forwards) and then the return offer (direction backwards).
 *     tags: [Bus Flights]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SelectFlightRequest'
 *     responses:
 *       200:
 *         description: Offer selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionOkResponse'
 *       400:
 *         description: BAD_REQUEST — no such offer in this session
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
