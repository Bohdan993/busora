/** @format */

'use strict';

// Pure builders that turn the network definition into table rows. No DB access,
// so they are unit-tested directly.

const {
  LANGUAGE_IDS,
  CITIES,
  LINES,
  UA_BASE_FARE_UAH,
  CZ_SURCHARGE_UAH,
  UAH_PER_CZK_LIST_RATE,
  ROUND_TRIP_FACTOR,
  FARE_ROUNDING,
  SCHEDULE_DAYS,
  SEATS_PER_BUS
} = require('./network');

const UAH_CURRENCY_ID = 1;
const CZK_CURRENCY_ID = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const roundFare = (amount) =>
  Math.round(amount / FARE_ROUNDING) * FARE_ROUNDING;

// One attribute row per locale: { [foreignKey]: id, languageId, name }.
function localizedRows(foreignKey, id, names) {
  return Object.entries(LANGUAGE_IDS).map(([code, languageId]) => {
    if (!names[code]) throw new Error(`${foreignKey} ${id}: no ${code} name`);
    return { [foreignKey]: id, languageId, name: names[code] };
  });
}

const directions = (line) => [line.outbound, line.inbound];

function routePath(routeGroupId, direction) {
  const stops = ([cityId, time]) => ({ cityId, placeId: cityId, time });
  return {
    routeGroupId,
    onboarding: direction.boarding.map(stops),
    outboarding: direction.dropOff.map(stops)
  };
}

// A route starts in the country of its first boarding city.
function routeRows() {
  const countryOf = (cityId) => CITIES.find((c) => c.id === cityId).countryId;
  return LINES.flatMap((line) =>
    directions(line).map((direction) => ({
      id: direction.routeId,
      countryId: countryOf(direction.boarding[0][0]),
      routePath: JSON.stringify(routePath(line.routeGroupId, direction))
    }))
  );
}

// City order along each direction (boarding stops, then drop-off stops).
function routeCityOrderRows() {
  return LINES.flatMap((line) =>
    directions(line).flatMap((direction) =>
      [...direction.boarding, ...direction.dropOff].map(([cityId], index) => ({
        lineGroup: line.routeGroupId,
        routeKey: direction.routeKey,
        cityId,
        position: index + 1
      }))
    )
  );
}

/**
 * Fares for every Ukrainian/Czech city pair on the same line: both directions
 * (prices are looked up by origin → destination) in both currencies (a search
 * prices in the origin city's currency).
 */
function priceRows() {
  return LINES.flatMap((line) => {
    const uaCities = line.outbound.boarding.map(([cityId]) => cityId);
    const czCities = line.outbound.dropOff.map(([cityId]) => cityId);

    return uaCities.flatMap((uaCityId) =>
      czCities.flatMap((czCityId) => {
        const oneWayUAH =
          UA_BASE_FARE_UAH[uaCityId] +
          CZ_SURCHARGE_UAH[line.routeGroupId][czCityId];
        const fares = [
          { currencyId: UAH_CURRENCY_ID, oneWay: oneWayUAH },
          {
            currencyId: CZK_CURRENCY_ID,
            oneWay: roundFare(oneWayUAH / UAH_PER_CZK_LIST_RATE)
          }
        ];
        const pairs = [
          [uaCityId, czCityId],
          [czCityId, uaCityId]
        ];
        return pairs.flatMap(([firstCityId, secondCityId]) =>
          fares.map(({ currencyId, oneWay }) => ({
            firstCityId,
            secondCityId,
            currencyId,
            priceOneWay: oneWay,
            priceRoundTrip: roundFare(oneWay * ROUND_TRIP_FACTOR)
          }))
        );
      })
    );
  });
}

// "YYYY-MM-DD" in UTC — busflights.dateOfDeparture is a DATEONLY column.
const toDateOnly = (date) => date.toISOString().slice(0, 10);

/** Daily departures on every route, starting at `startDate` (a Date). */
function flightRows(startDate, days = SCHEDULE_DAYS) {
  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const routeIds = LINES.flatMap((line) =>
    directions(line).map((d) => d.routeId)
  );
  return Array.from({ length: days }, (_, day) =>
    toDateOnly(new Date(start + day * MS_PER_DAY))
  ).flatMap((dateOfDeparture) =>
    routeIds.map((routeId) => ({
      routeId,
      dateOfDeparture,
      allSeats: SEATS_PER_BUS,
      freeSeats: SEATS_PER_BUS
    }))
  );
}

module.exports = {
  localizedRows,
  routeRows,
  routeCityOrderRows,
  priceRows,
  flightRows
};
