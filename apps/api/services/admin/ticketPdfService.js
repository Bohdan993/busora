/** @format */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  generateHTMLTicket,
  generatePDFTicket,
  deleteTicketPDFFile
} = require('../ticketService');
const {
  busflight: BusFlight,
  city: City,
  cityattributes: CityAttributes,
  discount: Discount,
  discountattributes: DiscountAttributes,
  language: Language,
  passenger: Passenger,
  passengerticket: PassengerTicket,
  place: Place,
  placeattributes: PlaceAttributes,
  route: Route,
  routeattributes: RouteAttributes,
  ticket: Ticket,
  ticketmeta: TicketMeta,
  ticketmetaattributes: TicketMetaAttributes
} = require('@database/models/index');
const { DEFAULT_LOCALE } = require('@root/config/market');
const { transformDate, transformTimestampToDate } = require('@helpers');
const constants = require('@helpers/constants.js');

/**
 * Builds a complete Sequelize query for fetching ticket data with all relations
 * @param {number} ticketId - The ticket ID
 * @param {number} languageId - The language ID (default: 1)
 * @returns {Object} Sequelize query object
 */
const buildTicketQuery = (ticketId, languageId = 1) => {
  return {
    attributes: [
      'id',
      'dateOfDeparture',
      'dateOfReturn',
      'dateOfCreature',
      'busFlightFromId',
      'busFlightToId',
      'price',
      'priceUAH',
      'currencyAbbr',
      'typeId',
      'statusId',
      'signature',
      'dateOfFirstUsage',
      'hasDiscount',
      'discountPercentage',
      'originId',
      'destinationId',
      'PDFFileName',
      'prevPDFFileName',
      'createdAt',
      'ticketNumber',
      'updatedAt',
      'languageId'
    ],
    where: { id: ticketId },
    include: [
      { model: Language, attributes: ['id', 'code'] },
      buildCityInclude('originCity', languageId),
      buildCityInclude('destinationCity', languageId),
      buildBusFlightInclude('busFlightFrom', languageId),
      buildBusFlightInclude('busFlightTo', languageId),
      buildPassengerTicketInclude(languageId),
      buildTicketMetaInclude('statusMeta', languageId),
      buildTicketMetaInclude('typeMeta', languageId)
    ],
    order: [
      ['id', 'ASC'],
      ['dateOfDeparture', 'ASC']
    ]
  };
};

/**
 * Loads a ticket with every relation needed for its PDF/HTML, with city, place
 * and route names in the ticket's own booking language.
 * @param {number} ticketId - The ticket ID
 * @returns {Promise<Object|null>} Ticket instance, or null if it doesn't exist
 */
const loadTicketWithRelations = async (ticketId) => {
  const ticket = await Ticket.findByPk(ticketId, {
    attributes: ['id', 'languageId']
  });
  if (!ticket) return null;
  return Ticket.findOne(buildTicketQuery(ticketId, ticket.languageId));
};

/**
 * Builds city include configuration for Sequelize query
 * @param {string} alias - The alias for the city relation
 * @param {number} languageId - The language ID
 * @returns {Object} City include configuration
 */
const buildCityInclude = (alias, languageId) => ({
  model: City,
  as: alias,
  include: [
    {
      model: CityAttributes,
      as: 'cityattrs',
      attributes: ['name', 'cityId', 'languageId'],
      where: { languageId: { [Op.in]: [languageId] } },
      include: [
        {
          model: Language,
          attributes: ['name', 'code'],
          where: { id: { [Op.in]: [languageId] } }
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
          where: { languageId: { [Op.in]: [languageId] } },
          include: [
            {
              model: Language,
              attributes: ['name', 'code'],
              where: { id: { [Op.in]: [languageId] } }
            }
          ]
        }
      ]
    }
  ]
});

/**
 * Builds bus flight include configuration for Sequelize query
 * @param {string} alias - The alias for the bus flight relation
 * @param {number} languageId - The language ID
 * @returns {Object} Bus flight include configuration
 */
const buildBusFlightInclude = (alias, languageId) => ({
  model: BusFlight,
  attributes: ['id', 'routeId', 'dateOfDeparture'],
  as: alias,
  include: [
    {
      model: Route,
      attributes: ['id', 'countryId', 'routePath'],
      include: [
        {
          model: RouteAttributes,
          required: false,
          as: 'routeattrs',
          attributes: ['name'],
          where: { languageId: { [Op.eq]: languageId } }
        },
        {
          model: Language,
          attributes: ['name', 'code'],
          where: { id: { [Op.in]: [languageId] } }
        }
      ]
    }
  ]
});

/**
 * Builds passenger ticket include configuration for Sequelize query
 * @param {number} languageId - The language ID
 * @returns {Object} Passenger ticket include configuration
 */
const buildPassengerTicketInclude = (languageId) => ({
  model: PassengerTicket,
  attributes: [
    'id',
    'passengerDiscountId',
    'discountCardNumber',
    'ticketId',
    'passengerId',
    'PDFFileName',
    'discountPercentage',
    'price',
    'priceUAH'
  ],
  include: [
    {
      model: Passenger,
      attributes: [
        'id',
        'name',
        'lastName',
        'phone',
        'additionalPhone',
        'dateOfBirth',
        'email',
        'type'
      ]
    },
    {
      model: Discount,
      attributes: ['id', 'coef'],
      include: [
        {
          model: DiscountAttributes,
          required: false,
          as: 'discountattrs',
          attributes: ['name'],
          where: { languageId: { [Op.eq]: languageId } }
        }
      ]
    }
  ]
});

/**
 * Builds ticket meta include configuration for Sequelize query
 * @param {string} alias - The alias for the ticket meta relation
 * @param {number} languageId - The language ID
 * @returns {Object} Ticket meta include configuration
 */
const buildTicketMetaInclude = (alias, languageId) => ({
  model: TicketMeta,
  as: alias,
  attributes: ['id', 'meta_key'],
  include: [
    {
      model: TicketMetaAttributes,
      as: 'ticketmetaattrs',
      attributes: ['name'],
      where: { languageId: { [Op.eq]: languageId } },
      required: false
    }
  ]
});

/**
 * Calculates base price per passenger considering global and individual discounts.
 * Children are now rows in passengertickets (passenger.type = 'child').
 */
const calculatePassengerPrices = (ticket) => {
  const allPTs = ticket?.passengertickets || [];
  const totalPassengers = allPTs.length;

  // PDF tickets always show price in UAH (the canonical amount LiqPay charges).
  // Fall back to the booking-currency price only for legacy rows missing priceUAH.
  const ticketPriceUAH = ticket?.priceUAH ?? ticket?.price;

  const hasIndividualDiscounts = allPTs.some((pt) => {
    if (pt.passenger?.type === 'child') {
      return pt.discountPercentage != null && pt.discountPercentage > 0;
    }
    return !!pt.discount;
  });

  let basePricePerPassenger;

  if (ticket?.hasDiscount && !hasIndividualDiscounts) {
    basePricePerPassenger = Math.round(ticketPriceUAH / totalPassengers);
  } else {
    const adultsCoefSum = allPTs
      .filter((pt) => pt.passenger?.type !== 'child')
      .reduce((sum, pt) => {
        const paymentCoef = pt?.discount?.coef ? 1 - pt.discount.coef : 1;
        return sum + paymentCoef;
      }, 0);

    const childrenCoefSum = allPTs
      .filter((pt) => pt.passenger?.type === 'child')
      .reduce((sum, pt) => {
        const discountPercentage = pt.discountPercentage || 0;
        const coef = discountPercentage ? (100 - discountPercentage) / 100 : 1;
        return sum + coef;
      }, 0);

    const totalCoefSum = adultsCoefSum + childrenCoefSum;
    basePricePerPassenger =
      totalCoefSum > 0
        ? ticketPriceUAH / totalCoefSum
        : ticketPriceUAH / (totalPassengers || 1);
  }

  return { basePricePerPassenger };
};

/**
 * Builds passengers information data with calculated prices
 * @param {Object} ticket - The ticket object
 * @param {number} languageId - The language ID for translations (default: 1 for Ukrainian)
 * @returns {Promise<Array>} Array of passenger data tuples
 */
const buildPassengersInfoData = async (ticket) => {
  const { basePricePerPassenger } = calculatePassengerPrices(ticket);

  const allPTs = ticket?.passengertickets || [];
  // Adults first, then children — keeps ticket number suffixes consistent
  const adults = allPTs.filter((pt) => pt.passenger?.type !== 'child');
  const children = allPTs.filter((pt) => pt.passenger?.type === 'child');

  const adultsData = adults.map((el, ind) => {
    const paymentCoef = el?.discount?.coef ? 1 - el.discount.coef : 1;
    // PDF shows UAH: prefer the authoritative stored per-passenger UAH price;
    // fall back to the booking-currency price, then the coefficient-derived
    // estimate, only for legacy rows missing the UAH value.
    const passengerPrice =
      el?.priceUAH != null
        ? el.priceUAH
        : el?.price != null
          ? el.price
          : Math.round(basePricePerPassenger * paymentCoef);

    return [
      'adult-passenger-' + (ind + 1),
      {
        name: el?.passenger?.name,
        'last-name': el?.passenger?.lastName,
        phone: el?.passenger?.phone,
        'date-of-birth': el?.passenger?.dateOfBirth,
        email: el?.passenger?.email,
        'phone-additional': el?.passenger?.additionalPhone,
        'discount-id': el?.discount?.id,
        'discount-percentage': el?.discount?.coef ? el.discount.coef * 100 : 0,
        'discount-name': el?.discount?.discountattrs?.[0]?.name,
        'card-discount': el?.discountCardNumber,
        'discount-ticket-price': passengerPrice,
        _ptId: el.id
      }
    ];
  });

  const childrenData = children.map((el, ind) => {
    const discountPercentage = el.discountPercentage || 0;
    const discountCoef = discountPercentage
      ? (100 - discountPercentage) / 100
      : 1;
    // PDF shows UAH: prefer the stored per-passenger UAH price; fall back to the
    // booking-currency price, then the coefficient estimate, for legacy rows.
    const passengerPrice =
      el?.priceUAH != null
        ? el.priceUAH
        : el?.price != null
          ? el.price
          : Math.round(basePricePerPassenger * discountCoef);

    return [
      'child-passenger-' + (ind + 1),
      {
        name: el?.passenger?.name,
        'last-name': el?.passenger?.lastName,
        'date-of-birth': el?.passenger?.dateOfBirth,
        'discount-id': el?.passengerDiscountId || null,
        'discount-percentage': discountPercentage,
        'discount-name': el?.discount?.discountattrs?.[0]?.name || '',
        'discount-ticket-price': passengerPrice,
        _ptId: el.id
      }
    ];
  });

  return [...adultsData, ...childrenData];
};

/**
 * Finds a place from the route path by type (onboarding/outboarding)
 * @param {Array} places - Array of places
 * @param {Object} routePath - Route path object
 * @param {string} type - Type of place ('onboarding' or 'outboarding')
 * @returns {Object} Found place object
 */
const findPlaceByRoute = (places, routePath, type) => {
  return places?.filter((elem) =>
    routePath?.[type].find(
      (item) => parseInt(elem.id) === parseInt(item?.placeId)
    )
  )?.[0];
};

/**
 * Gets place name by language code
 * @param {Object} place - Place object
 * @param {string} languageCode - Language code
 * @returns {string} Place name
 */
const getPlaceNameByLanguage = (place, languageCode) => {
  return place?.placeattrs?.find((el) => el?.language?.code === languageCode)
    ?.name;
};

/**
 * Gets time from route path for a specific place
 * @param {Object} routePath - Route path object
 * @param {string} type - Type ('onboarding' or 'outboarding')
 * @param {number} placeId - Place ID
 * @returns {string} Time string
 */
const getPlaceTime = (routePath, type, placeId) => {
  return routePath?.[type]?.find(
    (el) => parseInt(el?.placeId) === parseInt(placeId)
  )?.time;
};

/**
 * Finds the return route for a given route based on routeGroupId and different countryId
 * @param {number} routeId - The original route ID
 * @param {number} routeGroupId - The route group ID
 * @param {number} countryId - The original country ID
 * @param {number} languageId - The language ID
 * @returns {Promise<Object|null>} The return route object or null
 */
const findReturnRoute = async (
  routeId,
  routeGroupId,
  countryId,
  languageId = 1
) => {
  if (!routeGroupId || !countryId) return null;

  // Query for all routes with different countryId (exclude current route)
  const routes = await Route.findAll({
    where: {
      id: { [Op.ne]: routeId },
      countryId: { [Op.ne]: countryId }
    },
    attributes: ['id', 'countryId', 'routePath'],
    include: [
      {
        model: RouteAttributes,
        required: false,
        as: 'routeattrs',
        attributes: ['name'],
        where: { languageId: { [Op.eq]: languageId } }
      },
      {
        model: Language,
        attributes: ['name', 'code'],
        where: { id: { [Op.in]: [languageId] } }
      }
    ]
  });

  // Find the route with matching routeGroupId
  const returnRoute = routes.find(
    (route) => route.routePath?.routeGroupId === routeGroupId
  );

  return returnRoute || null;
};

/**
 * Builds complete places data structure for ticket
 * @param {Object} ticket - The ticket object
 * @param {string} languageCode - Language code (default: 'uk_UA')
 * @param {number} languageId - The language ID for database queries (default: 1)
 * @returns {Promise<Object>} Places data object
 */
const buildPlacesData = async (
  ticket,
  languageCode = 'uk_UA',
  languageId = 1
) => {
  const onBoardingPlace = findPlaceByRoute(
    ticket?.originCity?.places,
    ticket?.busFlightFrom?.route?.routePath,
    'onboarding'
  );
  const outBoardingPlace = findPlaceByRoute(
    ticket?.destinationCity?.places,
    ticket?.busFlightFrom?.route?.routePath,
    'outboarding'
  );

  const placesData = {
    from: {
      routeId: ticket?.busFlightFrom?.route?.id,
      routeName: ticket?.busFlightFrom?.route?.languages?.find(
        (el) => el?.code === languageCode
      )?.routeattributes?.name,
      routeNameUkr: ticket?.busFlightFrom?.route?.languages?.find(
        (el) => el?.code === languageCode
      )?.routeattributes?.name,
      onBoardingPlace: getPlaceNameByLanguage(onBoardingPlace, languageCode),
      onBoardingPlaceUkr: getPlaceNameByLanguage(onBoardingPlace, languageCode),
      outBoardingPlace: getPlaceNameByLanguage(outBoardingPlace, languageCode),
      outBoardingPlaceUkr: getPlaceNameByLanguage(
        outBoardingPlace,
        languageCode
      ),
      onBoardingTime: getPlaceTime(
        ticket?.busFlightFrom?.route?.routePath,
        'onboarding',
        onBoardingPlace?.id
      ),
      outBoardingTime: getPlaceTime(
        ticket?.busFlightFrom?.route?.routePath,
        'outboarding',
        outBoardingPlace?.id
      )
    },
    to: {}
  };

  // Handle return trip data
  if (ticket?.busFlightTo) {
    // Regular round-trip ticket with busFlightTo
    placesData.to = {
      routeId: ticket?.busFlightTo?.route?.id,
      routeName: ticket?.busFlightTo?.route?.languages?.find(
        (el) => el?.code === languageCode
      )?.routeattributes?.name,
      routeNameUkr: ticket?.busFlightTo?.route?.languages?.find(
        (el) => el?.code === languageCode
      )?.routeattributes?.name,
      onBoardingPlace: getPlaceNameByLanguage(outBoardingPlace, languageCode),
      onBoardingPlaceUkr: getPlaceNameByLanguage(
        outBoardingPlace,
        languageCode
      ),
      outBoardingPlace: getPlaceNameByLanguage(onBoardingPlace, languageCode),
      outBoardingPlaceUkr: getPlaceNameByLanguage(
        onBoardingPlace,
        languageCode
      ),
      onBoardingTime: getPlaceTime(
        ticket?.busFlightTo?.route?.routePath,
        'onboarding',
        outBoardingPlace?.id
      ),
      outBoardingTime: getPlaceTime(
        ticket?.busFlightTo?.route?.routePath,
        'outboarding',
        onBoardingPlace?.id
      )
    };
  } else if (ticket?.typeMeta?.meta_key === constants.OPEN_DATE) {
    // Open-date ticket: fetch return route from database
    const forwardRoute = ticket?.busFlightFrom?.route;
    const routeGroupId = forwardRoute?.routePath?.routeGroupId;
    const countryId = forwardRoute?.countryId;

    if (routeGroupId && countryId) {
      const returnRoute = await findReturnRoute(
        forwardRoute?.id,
        routeGroupId,
        countryId,
        languageId
      );

      if (returnRoute) {
        placesData.to = {
          routeId: returnRoute?.id,
          routeName: returnRoute?.languages?.find(
            (el) => el?.code === languageCode
          )?.routeattributes?.name,
          routeNameUkr: returnRoute?.languages?.find(
            (el) => el?.code === languageCode
          )?.routeattributes?.name,
          onBoardingPlace: getPlaceNameByLanguage(
            outBoardingPlace,
            languageCode
          ),
          onBoardingPlaceUkr: getPlaceNameByLanguage(
            outBoardingPlace,
            languageCode
          ),
          outBoardingPlace: getPlaceNameByLanguage(
            onBoardingPlace,
            languageCode
          ),
          outBoardingPlaceUkr: getPlaceNameByLanguage(
            onBoardingPlace,
            languageCode
          ),
          onBoardingTime: getPlaceTime(
            returnRoute?.routePath,
            'onboarding',
            outBoardingPlace?.id
          ),
          outBoardingTime: getPlaceTime(
            returnRoute?.routePath,
            'outboarding',
            onBoardingPlace?.id
          )
        };
      }
    }
  }

  return placesData;
};

/**
 * Builds complete options object for HTML ticket generation, in the ticket's
 * booking language.
 * @param {Object} ticket - Ticket loaded via loadTicketWithRelations
 * @param {string} template - Pug template in views/
 * @returns {Promise<Object>} HTML ticket options
 */
const buildHTMLTicketOptions = async (ticket, template = 'full-ticket.pug') => {
  const languageId = ticket?.languageId ?? 1;
  const languageCode = ticket?.language?.code ?? DEFAULT_LOCALE;

  return {
    languageCode,
    cities: {
      from: {
        id: ticket?.originCity?.id,
        name: ticket?.originCity?.cityattrs?.[0]?.name,
        nameUkr: ticket?.originCity?.cityattrs?.[0]?.name
      },
      to: {
        id: ticket?.destinationCity?.id,
        name: ticket?.destinationCity?.cityattrs?.[0]?.name,
        nameUkr: ticket?.destinationCity?.cityattrs?.[0]?.name
      }
    },
    signature: ticket?.signature,
    // PDF tickets ALWAYS show price in UAH (LiqPay charges UAH); the ticket's
    // booking currency (CZK for CZ-origin) is never printed. Fall back to the
    // booking-currency price only for legacy rows missing priceUAH.
    price: ticket?.priceUAH ?? ticket?.price,
    convertedPrice: ticket?.priceUAH ?? ticket?.price,
    currencyAbbr: 'UAH',
    passengersInfoData: await buildPassengersInfoData(ticket, languageId),
    dates: {
      departure: transformDate(ticket?.dateOfDeparture, languageCode),
      departureUkr: transformDate(ticket?.dateOfDeparture, languageCode),
      departurePure: ticket?.dateOfDeparture,
      return: ticket?.dateOfReturn
        ? transformDate(ticket?.dateOfReturn, languageCode)
        : null,
      returnUkr: ticket?.dateOfReturn
        ? transformDate(ticket?.dateOfReturn, languageCode)
        : null,
      returnPure: ticket?.dateOfReturn
    },
    places: await buildPlacesData(ticket, languageCode, languageId),
    ticket,
    constants,
    template,
    transformTimestampToDate
  };
};

/**
 * Builds HTML ticket options for a single passenger by overriding the
 * shared base options (cities, places, dates, etc.) that were already
 * computed once for the whole ticket.
 *
 * @param {Object} baseOptions    - Result of buildHTMLTicketOptions(ticket)
 * @param {Array}  passengerEntry - Single [key, data] tuple from buildPassengersInfoData
 * @param {number} passengerIndex - 1-based position of this passenger across the
 *                                  whole booking (used to suffix the ticket number)
 * @returns {Object} Options ready to pass directly to generateHTMLTicket
 */
const buildSinglePassengerHTMLTicketOptions = (
  baseOptions,
  passengerEntry,
  passengerIndex
) => {
  // passengerEntry[1]['discount-ticket-price'] is the pre-calculated per-passenger
  // price produced by buildPassengersInfoData → calculatePassengerPrices.
  // Fall back to the ticket total price if it is somehow absent.
  const passengerPrice =
    passengerEntry[1]?.['discount-ticket-price'] ?? baseOptions.price;

  // Give each passenger a unique ticket number by appending the 1-based index
  // as a suffix, e.g. "004239" becomes "004239-1", "004239-2", …
  // We spread the ticket object shallow-copy so the original is not mutated.
  const ticket = {
    ...JSON.parse(JSON.stringify(baseOptions.ticket)),
    ticketNumber: baseOptions.ticket?.ticketNumber
      ? `${baseOptions.ticket.ticketNumber}-${passengerIndex}`
      : baseOptions.ticket?.ticketNumber
  };

  return {
    ...baseOptions,
    ticket,
    // Replace the full passenger list with just this one passenger so the
    // Pug template renders a single-passenger ticket.
    passengersInfoData: [passengerEntry],
    price: passengerPrice,
    convertedPrice: passengerPrice
  };
};

/**
 * Generates one PDF file per passenger (adults + children) for a ticket.
 *
 * Strategy:
 *  1. Call buildHTMLTicketOptions once to get all shared data (places, cities,
 *     dates, discount lookups). This is the expensive DB step.
 *  2. Re-use that result for every passenger, overriding only the passenger-
 *     specific fields via buildSinglePassengerHTMLTicketOptions.
 *  3. For each passenger:
 *     a. Generate HTML → PDF.
 *     b. Delete the passenger's previous PDF file if one exists.
 *     c. Collect the result.
 *  4. Return the results array. DB persistence is done by the caller (Step 3)
 *     so this function stays focused on file generation only.
 *
 * Unique filenames are achieved by appending the passenger key to the ticket
 * signature before hashing, e.g. "<sig>_adult-passenger-1". This ensures each
 * passenger gets a distinct SHA-256 hash even when they share the same ticket.
 *
 * @param {Object} ticket - Full ticket object loaded via buildTicketQuery
 *                          (must include passengertickets with PDFFileName)
 * @returns {Promise<Array<{key: string, pdfName: string}>>}
 */
const generatePerPassengerPDFs = async (ticket, passengerId = null) => {
  // Build all shared options once. buildHTMLTicketOptions internally calls
  // buildPassengersInfoData which does discount DB lookups — we want that
  // to happen exactly once, not once per passenger.
  const baseOptions = await buildHTMLTicketOptions(ticket);

  // baseOptions.passengersInfoData is the full Array<[key, data]> for all
  // adults and children, already with calculated prices.
  const allPassengerEntries = baseOptions.passengersInfoData;

  // When a single passenger is requested, resolve its passengerticket id. We
  // still iterate the full list so the 1-based position (used for the
  // ticket-number suffix, e.g. 004254-2) stays correct, and only generate the
  // PDF for the matching passenger.
  let targetPtId = null;
  if (passengerId != null) {
    const pt = ticket.passengertickets?.find(
      (p) => String(p.passengerId) === String(passengerId)
    );
    targetPtId = pt?.id ?? null;
  }
  const singleMode = passengerId != null;

  const results = [];

  for (const [loopIndex, entry] of allPassengerEntries.entries()) {
    const ptId = entry[1]._ptId;
    // In single-passenger mode, skip everyone but the requested passenger.
    if (singleMode && ptId !== targetPtId) continue;

    const [key] = entry;
    const passengerIndex = loopIndex + 1;

    const singleOptions = buildSinglePassengerHTMLTicketOptions(
      baseOptions,
      entry,
      passengerIndex
    );
    const html = await generateHTMLTicket(singleOptions);
    const { pdfName } = await generatePDFTicket({
      html,
      signature: ticket.signature + '_' + key,
      ticketUpdateTimestamp: ticket.updatedAt
    });

    // Delete the previous PDF for this passenger if one already exists on disk.
    const pt = ticket.passengertickets?.find((p) => p.id === ptId);
    if (pt?.PDFFileName) {
      await deleteTicketPDFFile(pt.PDFFileName);
    }

    results.push({ key, pdfName, ptId });
  }

  return results;
};

/**
 * Persists per-passenger PDF filenames to the database after generation.
 *
 * Updates PDFFileName on each passenger's PassengerTicket row (adults and
 * children alike).
 *
 * Separation of concerns: this function only does DB writes. The file
 * generation and old-file cleanup live in generatePerPassengerPDFs.
 *
 * @param {Object} ticket  - Full ticket object (must include passengertickets)
 * @param {Array}  results - Array of { key, pdfName } from generatePerPassengerPDFs
 * @returns {Promise<void>}
 */
const persistPerPassengerPDFs = async (ticket, results) => {
  // All passengers (adults + children) are now in passengertickets.
  // Use ptId from each result to update the row directly.
  for (const { ptId, pdfName } of results) {
    if (!ptId) continue;
    await PassengerTicket.update(
      { PDFFileName: pdfName.slice(0, 64) },
      { where: { id: ptId } }
    );
  }
};

module.exports = {
  loadTicketWithRelations,
  buildTicketQuery,
  buildCityInclude,
  buildBusFlightInclude,
  buildPassengerTicketInclude,
  buildTicketMetaInclude,
  calculatePassengerPrices,
  buildPassengersInfoData,
  findPlaceByRoute,
  getPlaceNameByLanguage,
  getPlaceTime,
  findReturnRoute,
  buildPlacesData,
  buildHTMLTicketOptions,
  buildSinglePassengerHTMLTicketOptions,
  generatePerPassengerPDFs,
  persistPerPassengerPDFs
};
