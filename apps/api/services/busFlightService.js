/** @format */

const { Op } = require('sequelize');
const { customRoutesFilterMap } = require('@extra');
const {
  isSpecialDate,
  transformDate,
  isOneWay,
  isRound,
  isOpenDate,
  toSafeNumber,
  isValidDate
} = require('@helpers');
const constants = require('@helpers/constants.js');
const {
  busflight: BusFlight,
  route: Route
} = require('@database/models/index');

// === HELPER FUNCTIONS FOR BUS FLIGHT FILTERING ===

/**
 * Checks if a bus flight has enough free seats for passengers
 * @param {Object} busFlight - Bus flight object
 * @param {number|string} numOfPassengers - Number of passengers
 * @returns {boolean} - True if flight has enough seats
 */
function hasEnoughSeats(busFlight, numOfPassengers) {
  return parseInt(busFlight.freeSeats) >= parseInt(numOfPassengers);
}

/**
 * Parses route path from string to object if needed
 * @param {string|Object} routePath - Route path data
 * @returns {Object|null} - Parsed route path object
 */
function parseRoutePath(routePath) {
  if (!routePath) return null;

  if (typeof routePath === 'string') {
    try {
      return JSON.parse(routePath);
    } catch (error) {
      console.error('Failed to parse routePath:', error);
      return null;
    }
  }

  return routePath;
}

/**
 * Checks if a route supports travel between two cities
 * @param {Array} onboarding - Onboarding points
 * @param {Array} outboarding - Outboarding points
 * @param {number|string} originCityId - Origin city ID
 * @param {number|string} destinationCityId - Destination city ID
 * @returns {boolean} - True if route supports the travel
 */
function routeSupportsTravel(
  onboarding,
  outboarding,
  originCityId,
  destinationCityId
) {
  const hasOrigin = onboarding.some(
    (point) => parseInt(point?.cityId) === parseInt(originCityId)
  );
  const hasDestination = outboarding.some(
    (point) => parseInt(point?.cityId) === parseInt(destinationCityId)
  );

  return hasOrigin && hasDestination;
}

/**
 * Filters route points by city ID
 * @param {Array} points - Route points (onboarding/outboarding)
 * @param {number|string} cityId - City ID to filter by
 * @returns {Array} - Filtered points
 */
function filterRoutePointsByCity(points, cityId) {
  return points.filter((point) => parseInt(point?.cityId) === parseInt(cityId));
}

/**
 * Updates bus flight route path with filtered points
 * @param {Object} busFlight - Bus flight object
 * @param {Array} onboarding - Filtered onboarding points
 * @param {Array} outboarding - Filtered outboarding points
 */
function updateBusFlightRoutePath(busFlight, onboarding, outboarding) {
  if (!busFlight.route || !busFlight.route.routePath) return;

  busFlight.route.routePath.onboarding = onboarding;
  busFlight.route.routePath.outboarding = outboarding;
}

/**
 * Processes bus flights for forward direction (origin to destination)
 * @param {Array} busFlights - Array of bus flights
 * @param {number|string} originId - Origin city ID
 * @param {number|string} destinationId - Destination city ID
 * @returns {Array} - Processed forward direction flights
 */
function processForwardDirectionFlights(busFlights, originId, destinationId) {
  const resultFrom = [];

  busFlights.forEach((busFlight) => {
    const routePath = parseRoutePath(busFlight?.route?.routePath);

    if (!routePath) return;

    const { onboarding, outboarding } = routePath;

    if (routeSupportsTravel(onboarding, outboarding, originId, destinationId)) {
      const filteredOnboarding = filterRoutePointsByCity(onboarding, originId);
      const filteredOutboarding = filterRoutePointsByCity(
        outboarding,
        destinationId
      );

      updateBusFlightRoutePath(
        busFlight,
        filteredOnboarding,
        filteredOutboarding
      );
      resultFrom.push(busFlight);
    }
  });

  return resultFrom;
}

/**
 * Processes bus flights for return direction (destination to origin)
 * @param {Array} busFlights - Array of bus flights
 * @param {number|string} originId - Origin city ID
 * @param {number|string} destinationId - Destination city ID
 * @returns {Array} - Processed return direction flights
 */
function processReturnDirectionFlights(busFlights, originId, destinationId) {
  const resultTo = [];

  busFlights.forEach((busFlight) => {
    const routePath = parseRoutePath(busFlight?.route?.routePath);

    if (!routePath) return;

    const { onboarding, outboarding } = routePath;

    if (routeSupportsTravel(onboarding, outboarding, destinationId, originId)) {
      const filteredOnboarding = filterRoutePointsByCity(
        onboarding,
        destinationId
      );
      const filteredOutboarding = filterRoutePointsByCity(
        outboarding,
        originId
      );

      updateBusFlightRoutePath(
        busFlight,
        filteredOnboarding,
        filteredOutboarding
      );
      resultTo.push(busFlight);
    }
  });

  return resultTo;
}

/**
 * Filters flights by departure date
 * @param {Array} flights - Array of flights to filter
 * @param {string} targetDate - Target departure date
 * @param {boolean} isAlternative - Whether to get alternative dates (after target) or exact match
 * @returns {Array} - Filtered flights
 */
function filterFlightsByDate(flights, targetDate, isAlternative = false) {
  if (isAlternative) {
    return flights.filter(
      (flight) => String(flight?.dateOfDeparture) > String(targetDate)
    );
  }

  return flights.filter(
    (flight) => String(flight?.dateOfDeparture) === String(targetDate)
  );
}

/**
 * Gets route group ID from a bus flight
 * @param {Object} busFlight - Bus flight object
 * @returns {number|null} - Route group ID or null
 */
function getRouteGroupId(busFlight) {
  return busFlight?.route?.routePath?.routeGroupId || null;
}

/**
 * Finds matching flight by route group ID and removes it from array
 * @param {Array} sourceFlights - Array to search in
 * @param {number} targetRouteGroupId - Route group ID to match
 * @returns {Object|null} - Found and removed flight, or null
 */
function findAndRemoveFlightByRouteGroup(sourceFlights, targetRouteGroupId) {
  const index = sourceFlights.findIndex(
    (flight) => getRouteGroupId(flight) === targetRouteGroupId
  );

  if (index !== -1) {
    return sourceFlights.splice(index, 1)[0];
  }

  return null;
}

/**
 * Pairs flights from two arrays based on route group ID
 * @param {Array} primaryFlights - Primary flights array
 * @param {Array} secondaryFlights - Secondary flights array (will be modified)
 * @returns {Object} - Object with paired resultFrom and resultTo arrays
 */
function pairFlightsByRouteGroup(primaryFlights, secondaryFlights) {
  const resultFrom = [];
  const resultTo = [];

  primaryFlights.forEach((primaryFlight) => {
    const routeGroupId = getRouteGroupId(primaryFlight);
    const matchingFlight = findAndRemoveFlightByRouteGroup(
      secondaryFlights,
      routeGroupId
    );

    if (matchingFlight) {
      resultFrom.push(primaryFlight);
      resultTo.push(matchingFlight);
    }
  });

  return { resultFrom, resultTo };
}

/**
 * Determines filter key for custom routes filtering
 * @param {number|string} originId - Origin city ID
 * @param {number|string} destinationId - Destination city ID
 * @param {string} endDate - End date
 * @returns {number|null} - Filter key or null
 */
function getCustomRouteFilterKey(originId, destinationId, endDate) {
  const parsedOriginId = parseInt(originId);
  const parsedDestinationId = parseInt(destinationId);

  if (customRoutesFilterMap.hasOwnProperty(parsedOriginId)) {
    return parsedOriginId;
  }

  if (
    customRoutesFilterMap.hasOwnProperty(parsedDestinationId) &&
    !isSpecialDate(endDate)
  ) {
    return parsedDestinationId;
  }

  return null;
}

/**
 * Determines filter key for one-way custom routes filtering
 * @param {number|string} originId - Origin city ID
 * @param {number|string} destinationId - Destination city ID
 * @param {string} endDate - End date
 * @returns {number|null} - Filter key or null
 */
function getOneWayCustomRouteFilterKey(originId, destinationId, endDate) {
  const parsedOriginId = parseInt(originId);
  const parsedDestinationId = parseInt(destinationId);

  if (customRoutesFilterMap.hasOwnProperty(parsedOriginId)) {
    return parsedOriginId;
  }

  if (
    customRoutesFilterMap.hasOwnProperty(parsedDestinationId) &&
    isSpecialDate(endDate)
  ) {
    return parsedDestinationId;
  }

  return null;
}

/**
 * Checks if flight should be kept based on route group ID filtering
 * @param {number} filterKey - Filter key from customRoutesFilterMap
 * @param {Object} flight - Bus flight object
 * @returns {boolean} - True if flight should be kept
 */
function shouldKeepFlight(filterKey, flight) {
  const routeGroupId = getRouteGroupId(flight);
  return !customRoutesFilterMap[filterKey].includes(routeGroupId);
}

/**
 * Applies custom route filtering to flight results
 * @param {Object} results - Results object with resultFrom and resultTo
 * @param {number} filterKey - Filter key for customRoutesFilterMap
 * @param {boolean} isRoundTrip - Whether to filter both directions
 * @returns {Object} - Filtered results
 */
function applyCustomRouteFiltering(results, filterKey, isRoundTrip = true) {
  const filterFn = (flight) => shouldKeepFlight(filterKey, flight);

  const filteredResults = {
    resultFrom: results.resultFrom.filter(filterFn),
    resultTo: isRoundTrip ? results.resultTo.filter(filterFn) : results.resultTo
  };

  return filteredResults;
}

/**
 * Checks if a direction supports travel between cities for available dates
 * @param {Object} busFlight - Bus flight object
 * @param {number|string} originCityId - Origin city ID
 * @param {number|string} destinationCityId - Destination city ID
 * @returns {boolean} - True if direction is supported
 */
function supportsDirection(busFlight, originCityId, destinationCityId) {
  const routePath = parseRoutePath(busFlight?.route?.routePath);
  if (!routePath) return false;

  return routeSupportsTravel(
    routePath.onboarding,
    routePath.outboarding,
    originCityId,
    destinationCityId
  );
}

// === MAIN FILTERING FUNCTIONS ===

/**
 * Filters bus flights that have enough free seats for passengers
 * Single Responsibility: Only checks seat availability
 * @param {Object} params - Parameters object
 * @param {Array} params.busFlights - Array of bus flights
 * @param {number|string} params.numOfPassengers - Number of passengers
 * @returns {Array} - Filtered bus flights with enough seats
 */
function filterBusFlightsWithFreeSeats({ busFlights, numOfPassengers }) {
  if (!Array.isArray(busFlights)) return [];

  return busFlights.filter((busFlight) =>
    hasEnoughSeats(busFlight, numOfPassengers)
  );
}

/**
 * Filters and processes bus flights based on route compatibility and dates
 * Single Responsibility: Orchestrates the filtering process
 * @param {Object} params - Filtering parameters
 * @returns {Object} - Object with resultFrom and resultTo arrays
 */
function filterBusFlights({
  busFlights,
  originId,
  destinationId,
  startDate,
  endDate,
  customRoutesFilter = (arg) => arg,
  isAlternativeBusFlights = false
} = {}) {
  // Early return for invalid input
  if (!Array.isArray(busFlights) || !originId || !destinationId) {
    return { resultFrom: [], resultTo: [] };
  }

  // Process flights for both directions
  const resultFrom = processForwardDirectionFlights(
    busFlights,
    originId,
    destinationId
  );
  const resultTo = processReturnDirectionFlights(
    busFlights,
    originId,
    destinationId
  );

  // Filter by dates
  const dateFilteredFrom = filterFlightsByDate(
    resultFrom,
    startDate,
    isAlternativeBusFlights
  );
  const dateFilteredTo = filterFlightsByDate(
    resultTo,
    endDate,
    isAlternativeBusFlights
  );

  let result = {
    resultFrom: dateFilteredFrom,
    resultTo: dateFilteredTo
  };

  // Apply route selection and custom filtering
  if (!isSpecialDate(endDate) && !isAlternativeBusFlights) {
    result = selectBusFlights(
      result,
      customRoutesFilter.bind(null, originId, destinationId, endDate)
    );
  } else {
    result = customRoutesFilter(originId, destinationId, endDate, result);
  }

  return result;
}

/**
 * Selects and pairs bus flights by route group for round trips
 * @param {Object} data - Data object with resultFrom and resultTo arrays
 * @param {Function} customRouteFilter - Custom filtering function
 * @returns {Object} - Object with paired resultFrom and resultTo
 */
function selectBusFlights(data, customRouteFilter = (arg) => arg) {
  if (!data?.resultFrom?.length || !data?.resultTo?.length) {
    return { resultFrom: [], resultTo: [] };
  }

  // Create copies to avoid mutating original arrays
  const fromFlights = JSON.parse(JSON.stringify(data.resultFrom));
  const toFlights = JSON.parse(JSON.stringify(data.resultTo));

  let result;

  // Pair flights based on which direction has fewer options
  // Always maintain correct order: resultFrom = outbound, resultTo = return
  if (fromFlights.length > toFlights.length) {
    // Iterate through return flights (fewer), match with outbound flights
    const paired = pairFlightsByRouteGroup(toFlights, fromFlights);
    // Swap back to maintain correct order (from = outbound, to = return)
    result = {
      resultFrom: paired.resultTo,
      resultTo: paired.resultFrom
    };
  } else {
    // Iterate through outbound flights (fewer or equal), match with return flights
    result = pairFlightsByRouteGroup(fromFlights, toFlights);
  }

  // console.log("Paired bus flights", {
  //   result: customRouteFilter(result),
  // });

  // Apply custom filtering
  return customRouteFilter(result);
}

/**
 * Applies custom route filtering based on city-specific rules
 * Single Responsibility: Handles custom route exclusions
 * @param {number|string} originId - Origin city ID
 * @param {number|string} destinationId - Destination city ID
 * @param {string} endDate - End date string
 * @param {Object} results - Results object to filter
 * @returns {Object} - Filtered results
 */
function customRoutesFilter(originId, destinationId, endDate, results) {
  if (!results?.resultFrom?.length) {
    return results;
  }

  // Handle round trip filtering
  const roundTripFilterKey = getCustomRouteFilterKey(
    originId,
    destinationId,
    endDate
  );
  if (roundTripFilterKey) {
    // Only apply filter if there are routes that should be kept
    if (
      results.resultFrom.some((flight) =>
        shouldKeepFlight(roundTripFilterKey, flight)
      )
    ) {
      return applyCustomRouteFiltering(results, roundTripFilterKey, true);
    }
    return results;
  }

  // Handle one-way trip filtering
  const oneWayFilterKey = getOneWayCustomRouteFilterKey(
    originId,
    destinationId,
    endDate
  );
  if (oneWayFilterKey) {
    // Only apply filter if there are routes that should be kept
    if (
      results.resultFrom.some((flight) =>
        shouldKeepFlight(oneWayFilterKey, flight)
      )
    ) {
      return applyCustomRouteFiltering(results, oneWayFilterKey, false);
    }
    return results;
  }

  return results;
}

/**
 * Applies the shared-city route-group exclusion (customRoutesFilterMap) to a
 * FLAT list of flights — as opposed to the paired resultFrom/resultTo shape the
 * booking flow uses. Some cities sit on more than one route group (e.g. Дрезден
 * / 12, which is on both the Düsseldorf and Munich lines); when such a city is
 * the selected origin or destination, the configured non-canonical route
 * group(s) are dropped so the same city pair isn't offered by an ambiguous
 * duplicate line.
 *
 * Mirrors customRoutesFilter's safety guard: if the exclusion would remove every
 * flight, the list is returned unchanged.
 *
 * @param {Array} flights - Flat array of bus-flight JSON objects (route.routePath loaded)
 * @param {number|string} originId - Selected origin city ID
 * @param {number|string} destinationId - Selected destination city ID
 * @returns {Array} - Filtered flights
 */
function filterFlatFlightsByCustomRouteGroup(flights, originId, destinationId) {
  if (!Array.isArray(flights) || flights.length === 0) return flights;

  const parsedOrigin = parseInt(originId);
  const parsedDestination = parseInt(destinationId);
  // Origin takes priority, then destination — matching the existing
  // getCustomRouteFilterKey / getOneWayCustomRouteFilterKey precedence.
  const filterKey = customRoutesFilterMap.hasOwnProperty(parsedOrigin)
    ? parsedOrigin
    : customRoutesFilterMap.hasOwnProperty(parsedDestination)
      ? parsedDestination
      : null;

  if (filterKey === null) return flights;
  // Never empty the list: only exclude when at least one flight survives.
  if (!flights.some((flight) => shouldKeepFlight(filterKey, flight))) {
    return flights;
  }
  return flights.filter((flight) => shouldKeepFlight(filterKey, flight));
}

/**
 * Filters bus flights to get available departure dates for a route
 * Single Responsibility: Extracts available dates from flights
 * @param {Array} busFlights - Array of bus flights
 * @param {number|string} originId - Origin city ID
 * @param {number|string} destinationId - Destination city ID
 * @param {boolean} isStartDate - Whether to exclude first date (for return dates)
 * @param {string} direction - Direction constant (FORWARDS/BACKWARDS)
 * @returns {Array} - Array of unique departure dates
 */
function filterBusFlightsAvailableDates(
  busFlights,
  originId,
  destinationId,
  isStartDate,
  direction
) {
  if (!Array.isArray(busFlights)) return [];

  const validFlights = [];

  busFlights.forEach((busFlight) => {
    let isValidDirection = false;

    if (direction === constants.FORWARDS) {
      isValidDirection = supportsDirection(busFlight, originId, destinationId);
    } else if (direction === constants.BACKWARDS) {
      isValidDirection = supportsDirection(busFlight, destinationId, originId);
    }

    if (isValidDirection) {
      validFlights.push(busFlight);
    }
  });

  // Extract unique dates
  const uniqueDates = Array.from(
    new Set(validFlights.map((flight) => flight?.dateOfDeparture))
  ).filter(Boolean);

  // Remove first date if isStartDate is true (for return date selection)
  return isStartDate ? uniqueDates.slice(1) : uniqueDates;
}

/**
 * Fetches the available departure dates for a city pair and direction.
 *
 * Wraps the shared query (future flights that still have free seats) and the
 * date filtering so the public booking flow and the admin ticket form produce
 * identical results from a single source of truth.
 *
 * @param {Object} params
 * @param {number|string} params.originId - Origin city ID
 * @param {number|string} params.destinationId - Destination city ID
 * @param {string} [params.startDate] - Only dates on/after this are returned (defaults to today)
 * @param {string} [params.direction] - FORWARDS (origin→destination) or BACKWARDS (return leg)
 * @returns {Promise<Array<string>>} - Unique available departure dates
 */
async function getAvailableDates({
  originId,
  destinationId,
  startDate = null,
  direction = constants.FORWARDS
} = {}) {
  // Only treat startDate as a lower bound when an actual date was supplied.
  // `new Date(null)` is the 1970 epoch (a "valid" date), so guarding on the
  // raw value prevents an omitted startDate from surfacing past dates.
  const startDateInstance = startDate ? new Date(startDate) : null;
  const hasValidStartDate =
    !!startDateInstance && isValidDate(startDateInstance);

  const busFlights = await BusFlight.findAll({
    attributes: ['id', 'allSeats', 'freeSeats', 'routeId', 'dateOfDeparture'],
    where: {
      freeSeats: {
        [Op.gte]: 1
      },
      dateOfDeparture: {
        [Op.gte]: hasValidStartDate ? startDateInstance : new Date()
      }
    },
    include: [
      {
        model: Route
      }
    ],
    order: [
      ['dateOfDeparture', 'ASC'],
      ['routeId', 'ASC']
    ]
  });

  return filterBusFlightsAvailableDates(
    busFlights?.map((bf) => bf?.toJSON()),
    originId,
    destinationId,
    hasValidStartDate,
    direction
  );
}

/**
 * Calculates pricing for a bus flight, including discount logic for one-way and round-trip tickets.
 *
 * @param {Object} params - Function parameters.
 * @param {Object} params.el - The bus flight object from `resultFrom`.
 * @param {number} params.ind - Index of the current flight in the array.
 * @param {Array<Object>} params.price - Array of base prices per city.
 * @param {Object} params.busFlights - Full set of bus flight data including resultTo.
 * @param {number|string} params.originId - Origin city ID.
 * @param {number|string} params.destinationId - Destination city ID.
 *
 * @returns {Object} Object containing calculated prices:
 *   - priceOneWay
 *   - priceOneWayFull
 *   - priceRoundTrip
 *   - priceRoundTripFull
 *   - alternativeOneHalfRoundTripPrice
 *   - alternativeOneHalfRoundTripPriceFull
 */
function calcBusFlightPrice({
  el,
  ind,
  price,
  busFlights,
  originId,
  destinationId
} = {}) {
  // Base price from origin to destination
  const priceForwards = price.find((p) => +p?.firstCityId === +originId);

  // Base price for the return leg (destination to origin)
  const priceBackwards = price.find((p) => +p?.firstCityId === +destinationId);

  // Guard: If prices for either direction are missing, exit early
  if (!priceForwards || !priceBackwards) return {};

  // Discount coefficients (0 if not present)
  const coefForward = parseFloat(el?.discount?.coef || 0);
  const coefBackward = parseFloat(
    busFlights?.resultTo?.[ind]?.discount?.coef || 0
  );

  // One-way price with discount applied (if any)
  const oneWayDiscounted = toSafeNumber(
    Math.round(priceForwards.priceOneWay * (1 - coefForward))
  );

  // Half of round trip prices for both directions
  const roundTripHalfForward = toSafeNumber(priceForwards.priceRoundTrip / 2);
  const roundTripHalfBackward = toSafeNumber(priceBackwards.priceRoundTrip / 2);

  // Round trip with both discounts applied to their respective halves
  const roundTripDiscounted = toSafeNumber(
    Math.round(
      roundTripHalfForward * (1 - coefForward) +
        roundTripHalfBackward * (1 - coefBackward)
    )
  );

  const result = {
    ...priceForwards, // Include original pricing data
    priceOneWayFull: toSafeNumber(priceForwards.priceOneWay),
    priceOneWay: oneWayDiscounted,
    priceRoundTripFull: toSafeNumber(
      Math.round(roundTripHalfForward + roundTripHalfBackward)
    ),
    priceRoundTrip: roundTripDiscounted,
    alternativeOneHalfRoundTripPriceFull: toSafeNumber(
      Math.round(roundTripHalfForward)
    ),
    alternativeOneHalfRoundTripPrice: toSafeNumber(
      Math.round(roundTripHalfForward * (1 - coefForward))
    )
  };

  return result;
}

function createEmptyBusFlightLikeObj() {
  return {
    cities: {
      from: {},
      to: {}
    },
    places: {
      from: {},
      to: {}
    },
    dates: {}
  };
}

// === HELPER FUNCTIONS FOR BUS FLIGHT TRANSFORMATION ===

/**
 * Finds and returns a city by ID from the cities array
 * @param {Array} cities - Array of cities
 * @param {number|string} cityId - City ID to find
 * @returns {Object|undefined} - Found city object
 */
function findCityById(cities, cityId) {
  return cities?.find((city) => parseInt(city?.id) === parseInt(cityId));
}

/**
 * Gets localized name from city attributes
 * @param {Object} city - City object
 * @param {string} languageCode - Language code (e.g., "uk_UA")
 * @returns {string|undefined} - Localized city name
 */
function getLocalizedCityName(city, languageCode) {
  return city?.cityattrs?.find((attr) => attr?.language?.code === languageCode)
    ?.name;
}

/**
 * Gets localized name from place attributes
 * @param {Object} place - Place object
 * @param {string} languageCode - Language code
 * @returns {string|undefined} - Localized place name
 */
function getLocalizedPlaceName(place, languageCode) {
  return place?.placeattrs?.find(
    (attr) => attr?.language?.code === languageCode
  )?.name;
}

/**
 * Gets localized route name from route languages
 * @param {Object} route - Route object
 * @param {string} languageCode - Language code
 * @returns {string|undefined} - Localized route name
 */
function getLocalizedRouteName(route, languageCode) {
  return route?.languages?.find((lang) => lang?.code === languageCode)
    ?.routeattributes?.name;
}

/**
 * Finds places that match the route path boarding points
 * @param {Array} places - Array of places from city
 * @param {Array} routeBoardingPoints - Onboarding/outboarding points from route
 * @returns {Array} - Filtered places that match route points
 */
function findMatchingPlaces(places, routeBoardingPoints) {
  return (
    places?.filter((place) =>
      routeBoardingPoints.find(
        (point) => parseInt(place.id) === parseInt(point?.placeId)
      )
    ) || []
  );
}

/**
 * Finds boarding time for a specific place in route path
 * @param {Array} routeBoardingPoints - Route boarding points
 * @param {number|string} placeId - Place ID to find time for
 * @returns {string|undefined} - Boarding time
 */
function findBoardingTime(routeBoardingPoints, placeId) {
  return routeBoardingPoints.find(
    (point) => parseInt(point?.placeId) === parseInt(placeId)
  )?.time;
}

/**
 * Generates unique ID for bus flight transformation result
 * @param {boolean} isAlternativeBusFlights - Whether this is alternative flights
 * @param {string} direction - Direction constant
 * @param {number} flightIndex - Index of flight
 * @param {number} onboardingIndex - Index of onboarding place
 * @param {number} outboardingIndex - Index of outboarding place
 * @returns {string} - Generated unique ID
 */
function generateBusFlightId(
  isAlternativeBusFlights,
  direction,
  flightIndex,
  onboardingIndex,
  outboardingIndex
) {
  if (!isAlternativeBusFlights) {
    return `main-ticket-${flightIndex}-${onboardingIndex}-${outboardingIndex}`;
  }

  const prefix =
    direction === constants.FORWARDS
      ? 'alternative-ticket-from'
      : 'alternative-ticket-to';
  return `${prefix}-${flightIndex}-${onboardingIndex}-${outboardingIndex}`;
}

/**
 * Determines ticket type based on end date
 * @param {string} endDate - End date string
 * @returns {string} - Ticket type constant
 */
function determineTicketType(endDate) {
  if (!isSpecialDate(endDate) || isRound(endDate)) {
    return constants.ROUND;
  }
  if (isOneWay(endDate)) {
    return constants.ONE_WAY;
  }
  return constants.OPEN_DATE;
}

/**
 * Creates city information object with localized names
 * @param {Object} city - City object
 * @param {string} languageCode - Language code
 * @returns {Object} - City info with localized names
 */
function createCityInfo(city, languageCode) {
  return {
    id: city?.id,
    name: getLocalizedCityName(city, languageCode),
    nameUkr: getLocalizedCityName(city, 'uk_UA')
  };
}

/**
 * Creates place information object for the "from" direction
 * @param {Object} params - Parameters object
 * @returns {Object} - Place info object
 */
function createFromPlaceInfo({
  route,
  onboardingPlace,
  outboardingPlace,
  languageCode
}) {
  return {
    routeId: route?.id,
    routeName: getLocalizedRouteName(route, languageCode),
    routeNameUkr: getLocalizedRouteName(route, 'uk_UA'),
    onBoardingPlace: getLocalizedPlaceName(onboardingPlace, languageCode),
    onBoardingPlaceUkr: getLocalizedPlaceName(onboardingPlace, 'uk_UA'),
    outBoardingPlace: getLocalizedPlaceName(outboardingPlace, languageCode),
    outBoardingPlaceUkr: getLocalizedPlaceName(outboardingPlace, 'uk_UA'),
    onBoardingTime: findBoardingTime(
      route?.routePath?.onboarding,
      onboardingPlace?.id
    ),
    outBoardingTime: findBoardingTime(
      route?.routePath?.outboarding,
      outboardingPlace?.id
    )
  };
}

/**
 * Creates place information object for the "to" direction
 * @param {Object} params - Parameters object
 * @returns {Object} - Place info object
 */
function createToPlaceInfo({
  route,
  onboardingPlace,
  outboardingPlace,
  languageCode
}) {
  if (!route) return {};

  return {
    routeId: route?.id,
    routeName: getLocalizedRouteName(route, languageCode),
    routeNameUkr: getLocalizedRouteName(route, 'uk_UA'),
    onBoardingPlace: getLocalizedPlaceName(outboardingPlace, languageCode),
    onBoardingPlaceUkr: getLocalizedPlaceName(outboardingPlace, 'uk_UA'),
    outBoardingPlace: getLocalizedPlaceName(onboardingPlace, languageCode),
    outBoardingPlaceUkr: getLocalizedPlaceName(onboardingPlace, 'uk_UA'),
    onBoardingTime: findBoardingTime(
      route?.routePath?.onboarding,
      outboardingPlace?.id
    ),
    outBoardingTime: findBoardingTime(
      route?.routePath?.outboarding,
      onboardingPlace?.id
    )
  };
}

/**
 * Calculates discount percentage based on flight type and conditions
 * @param {Object} params - Parameters object
 * @returns {number} - Discount percentage
 */
function calculateDiscountPercentage({
  fromFlight,
  toFlight,
  endDate,
  isAlternativeBusFlights
}) {
  const fromDiscount = Number(fromFlight?.discount?.coef || 0) * 100;
  const toDiscount = Number(toFlight?.discount?.coef || 0) * 100;

  const shouldAverageDiscount =
    ((!isSpecialDate(endDate) || isRound(endDate) || isOpenDate(endDate)) &&
      !isAlternativeBusFlights) ||
    (isOpenDate(endDate) && isAlternativeBusFlights);

  return shouldAverageDiscount ? (fromDiscount + toDiscount) / 2 : fromDiscount;
}

/**
 * Checks if a flight has a meaningful discount (coef > 0)
 * @param {Object} flight - Flight object
 * @returns {boolean} - True if flight has a discount with coef > 0
 */
function hasActualDiscount(flight) {
  return flight?.discount?.coef && Number(flight.discount.coef) > 0;
}

/**
 * Creates date information object
 * @param {Object} params - Parameters object
 * @returns {Object} - Dates object with various formats
 */
function createDatesInfo({ fromFlight, toFlight, endDate, languageCode }) {
  const returnDate = toFlight?.dateOfDeparture || endDate;

  return {
    departure: transformDate(fromFlight?.dateOfDeparture, languageCode),
    departureUkr: transformDate(fromFlight?.dateOfDeparture),
    departurePure: fromFlight?.dateOfDeparture,
    return: transformDate(returnDate, languageCode),
    returnUkr: transformDate(returnDate),
    returnPure: returnDate
  };
}

/**
 * Creates pricing information for alternative flights
 * @param {Object} params - Parameters object
 * @returns {Object} - Price information object
 */
function createAlternativePricing({ calcPrice, endDate, currency }) {
  const getPrice = (isFullPrice) => {
    if (!isSpecialDate(endDate) || isRound(endDate)) {
      return isFullPrice
        ? calcPrice?.alternativeOneHalfRoundTripPriceFull
        : calcPrice?.alternativeOneHalfRoundTripPrice;
    }
    if (isOneWay(endDate)) {
      return isFullPrice ? calcPrice?.priceOneWayFull : calcPrice?.priceOneWay;
    }
    return isFullPrice
      ? calcPrice?.priceRoundTripFull
      : calcPrice?.priceRoundTrip;
  };

  const purePriceFull = getPrice(true);
  const purePrice = getPrice(false);

  return {
    purePriceFull: `${purePriceFull}`,
    purePrice: `${purePrice}`,
    priceFull: `${purePriceFull} ${currency?.symbol}`,
    price: `${purePrice} ${currency?.symbol}`
  };
}

/**
 * Creates pricing information for main flights
 * @param {Object} params - Parameters object
 * @returns {Object} - Price information object
 */
function createMainPricing({ calcPrice, endDate, currency }) {
  const purePriceFull = isOneWay(endDate)
    ? calcPrice?.priceOneWayFull
    : calcPrice?.priceRoundTripFull;
  const purePrice = isOneWay(endDate)
    ? calcPrice?.priceOneWay
    : calcPrice?.priceRoundTrip;

  return {
    purePriceFull: `${purePriceFull}`,
    purePrice: `${purePrice}`,
    priceFull: `${purePriceFull} ${currency?.symbol}`,
    price: `${purePrice} ${currency?.symbol}`
  };
}

/**
 * Creates a complete bus flight result object
 * @param {Object} params - All parameters needed for transformation
 * @returns {Object} - Complete bus flight result object
 */
function createBusFlightResult(params) {
  const {
    fromFlight,
    toFlight,
    flightIndex,
    onboardingIndex,
    outboardingIndex,
    onboardingPlace,
    outboardingPlace,
    cityFrom,
    cityTo,
    endDate,
    languageCode,
    isAlternativeBusFlights,
    direction,
    calcPrice,
    currency
  } = params;

  // Create base result object
  const result = {
    id: generateBusFlightId(
      isAlternativeBusFlights,
      direction,
      flightIndex,
      onboardingIndex,
      outboardingIndex
    ),
    type: determineTicketType(endDate),
    busFlightFromId: fromFlight?.id,
    busFlightToId: toFlight?.id || null,
    cities: {
      from: createCityInfo(cityFrom, languageCode),
      to: createCityInfo(cityTo, languageCode)
    },
    places: {
      from: createFromPlaceInfo({
        route: fromFlight?.route,
        onboardingPlace,
        outboardingPlace,
        languageCode
      }),
      to: {}
    },
    dates: createDatesInfo({ fromFlight, toFlight, endDate, languageCode }),
    hasDiscount: hasActualDiscount(fromFlight) || hasActualDiscount(toFlight),
    discountPercentage: calculateDiscountPercentage({
      fromFlight,
      toFlight,
      endDate,
      isAlternativeBusFlights
    })
  };

  // Add "to" place information for non-special dates
  if (!isSpecialDate(endDate)) {
    result.places.to = createToPlaceInfo({
      route: toFlight?.route,
      onboardingPlace,
      outboardingPlace,
      languageCode
    });
  }

  // Add pricing information
  const pricing = isAlternativeBusFlights
    ? createAlternativePricing({ calcPrice, endDate, currency })
    : createMainPricing({ calcPrice, endDate, currency });

  return { ...result, ...pricing };
}

/**
 * Transforms bus flights data into formatted result objects
 * Following Single Responsibility Principle - this function orchestrates the transformation
 * @param {Object} params - Transformation parameters
 * @returns {Array} - Array of transformed bus flight objects
 */
function transformBusFlights({
  busFlights,
  cities,
  price,
  currency,
  originId,
  destinationId,
  endDate,
  languageCode = 'uk_UA',
  languageId = 1,
  isAlternativeBusFlights = false,
  direction = constants.FORWARDS
}) {
  // Early return if no data
  if (!busFlights?.resultFrom?.length || !cities?.length) {
    return [];
  }

  const result = [];
  const cityFrom = findCityById(cities, originId);
  const cityTo = findCityById(cities, destinationId);

  // Early return if cities not found
  if (!cityFrom || !cityTo) {
    return [];
  }

  busFlights.resultFrom.forEach((fromFlight, flightIndex) => {
    const toFlight = busFlights?.resultTo?.[flightIndex];

    // Find matching places for this route
    const onboardingPlaces = findMatchingPlaces(
      cityFrom?.places,
      fromFlight?.route?.routePath?.onboarding
    );
    const outboardingPlaces = findMatchingPlaces(
      cityTo?.places,
      fromFlight?.route?.routePath?.outboarding
    );

    // Generate results for all place combinations
    onboardingPlaces.forEach((onboardingPlace, onboardingIndex) => {
      outboardingPlaces.forEach((outboardingPlace, outboardingIndex) => {
        const calcPrice = calcBusFlightPrice({
          el: fromFlight,
          ind: flightIndex,
          price,
          busFlights,
          originId,
          destinationId
        });

        const busFlightResult = createBusFlightResult({
          fromFlight,
          toFlight,
          flightIndex,
          onboardingIndex,
          outboardingIndex,
          onboardingPlace,
          outboardingPlace,
          cityFrom,
          cityTo,
          endDate,
          languageCode,
          isAlternativeBusFlights,
          direction,
          calcPrice,
          currency
        });

        result.push(busFlightResult);
      });
    });
  });

  return result;
}

function transformBusFlightsTableKey(key) {
  const keysMap = {
    busFlightId: 'id'
  };

  if (keysMap.hasOwnProperty(key)) return keysMap[key];
  return key;
}

module.exports = {
  createEmptyBusFlightLikeObj,
  customRoutesFilter,
  filterBusFlights,
  filterBusFlightsAvailableDates,
  getAvailableDates,
  filterBusFlightsWithFreeSeats,
  transformBusFlights,
  transformBusFlightsTableKey,
  selectBusFlights,
  // Helper functions (exported for potential reuse and testing)
  findCityById,
  getLocalizedCityName,
  getLocalizedPlaceName,
  getLocalizedRouteName,
  findMatchingPlaces,
  createBusFlightResult, // Bus flight filtering helpers
  hasEnoughSeats,
  parseRoutePath,
  routeSupportsTravel,
  supportsDirection,
  filterFlatFlightsByCustomRouteGroup,
  processForwardDirectionFlights,
  processReturnDirectionFlights,
  pairFlightsByRouteGroup,
  shouldKeepFlight,
  applyCustomRouteFiltering,
  hasActualDiscount
};
