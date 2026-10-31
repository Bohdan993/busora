/** @format */

const { Op, QueryTypes } = require('sequelize');
const {
  sequelize,
  route: Route,
  routeattributes: RouteAttributes,
  city: City,
  cityattributes: CityAttributes,
  country: Country,
  countryattributes: CountryAttributes,
  currency: Currency,
  place: Place,
  placeattributes: PlaceAttributes,
  busflightprices: BusFlightPrices,
  language: Language
} = require('@database/models/index');

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Stops of one direction in travel order (boarding, then drop-off), each with
 * the day it is reached on: 0 = the departure day. Times are wall-clock
 * "HH:MM", so a time earlier than the previous stop's means the next day.
 * That holds as long as no leg between two stops takes 24 h or more — true
 * for every route in the seed, where legs are a few hours each.
 */
function withDayOffsets(boarding, dropOff, placeNames) {
  let dayOffset = 0;
  let previous = -1;
  const annotate = (kind) => (stop) => {
    const minutes = toMinutes(stop.time);
    if (minutes < previous) dayOffset += 1;
    previous = minutes;
    return {
      kind,
      cityId: stop.cityId,
      placeId: stop.placeId,
      placeName: placeNames.get(stop.placeId) ?? null,
      time: stop.time,
      dayOffset
    };
  };
  return [
    ...boarding.map(annotate('boarding')),
    ...dropOff.map(annotate('dropOff'))
  ];
}

/**
 * Shapes the network for API clients: cities, lines with their two directions
 * (stops, times, weekdays) and every fare. Pure — the inputs are plain rows
 * loaded by getNetwork().
 */
function buildNetwork({ routes, cities, prices, weekdays }) {
  const placeNames = new Map(
    cities.flatMap((city) =>
      (city.places ?? []).map((place) => [
        place.id,
        place.placeattrs?.[0]?.name ?? null
      ])
    )
  );

  const weekdaysByRoute = new Map();
  for (const { routeId, weekday } of weekdays) {
    const days = weekdaysByRoute.get(routeId) ?? [];
    days.push(Number(weekday));
    weekdaysByRoute.set(routeId, days);
  }

  const lines = new Map();
  for (const route of [...routes].sort((a, b) => a.id - b.id)) {
    const path =
      typeof route.routePath === 'string'
        ? JSON.parse(route.routePath)
        : route.routePath;
    const lineId = path.routeGroupId;
    if (!lines.has(lineId)) lines.set(lineId, { id: lineId, directions: [] });
    lines.get(lineId).directions.push({
      routeId: route.id,
      name: route.routeattrs?.[0]?.name ?? null,
      countryId: route.countryId,
      weekdays: (weekdaysByRoute.get(route.id) ?? []).sort((a, b) => a - b),
      stops: withDayOffsets(path.onboarding, path.outboarding, placeNames)
    });
  }

  return {
    cities: cities
      .map((city) => ({
        id: city.id,
        name: city.cityattrs?.[0]?.name ?? null,
        country: {
          id: city.country?.id ?? city.countryId,
          name: city.country?.countryattrs?.[0]?.name ?? null
        },
        currency: {
          abbr: city.currency?.abbr ?? null,
          symbol: city.currency?.symbol ?? null
        }
      }))
      .sort((a, b) => a.id - b.id),
    lines: [...lines.values()].sort((a, b) => a.id - b.id),
    fares: prices
      .map((price) => ({
        fromCityId: price.firstCityId,
        toCityId: price.secondCityId,
        currency: price.currency?.abbr ?? null,
        oneWay: Number(price.priceOneWay),
        roundTrip: Number(price.priceRoundTrip)
      }))
      .sort(
        (a, b) =>
          a.fromCityId - b.fromCityId ||
          a.toCityId - b.toCityId ||
          String(a.currency).localeCompare(String(b.currency))
      )
  };
}

const named = (model, as, languageId, required = true) => ({
  model,
  as,
  attributes: ['name'],
  where: { languageId: { [Op.eq]: languageId } },
  required
});

/** Loads and shapes the network with names in `languageCode`. */
async function getNetwork(languageCode) {
  const language = await Language.findOne({ where: { code: languageCode } });
  const languageId = language?.id;

  const [routes, cities, prices, currencies, weekdays] = await Promise.all([
    Route.findAll({
      attributes: ['id', 'countryId', 'routePath'],
      include: [named(RouteAttributes, 'routeattrs', languageId, false)]
    }),
    City.findAll({
      attributes: ['id', 'countryId'],
      include: [
        named(CityAttributes, 'cityattrs', languageId),
        {
          model: Country,
          attributes: ['id'],
          include: [named(CountryAttributes, 'countryattrs', languageId)]
        },
        { model: Currency, attributes: ['abbr', 'symbol'] },
        {
          model: Place,
          attributes: ['id'],
          required: false,
          include: [named(PlaceAttributes, 'placeattrs', languageId, false)]
        }
      ]
    }),
    // busflightprices has no id column, so no include (Sequelize would select
    // the missing primary key); currencies are joined below instead
    BusFlightPrices.findAll({
      attributes: [
        'firstCityId',
        'secondCityId',
        'currencyId',
        'priceOneWay',
        'priceRoundTrip'
      ],
      raw: true
    }),
    Currency.findAll({ attributes: ['id', 'abbr'], raw: true }),
    // Days a route actually runs, from its upcoming flights
    sequelize.query(
      'SELECT routeId, DAYOFWEEK(dateOfDeparture) - 1 AS weekday FROM busflights ' +
        'WHERE dateOfDeparture >= CURDATE() GROUP BY routeId, weekday',
      { type: QueryTypes.SELECT }
    )
  ]);

  const plain = (rows) => rows.map((row) => row.toJSON());
  const abbrById = new Map(currencies.map(({ id, abbr }) => [id, abbr]));
  return buildNetwork({
    routes: plain(routes),
    cities: plain(cities),
    prices: prices.map((price) => ({
      ...price,
      currency: { abbr: abbrById.get(price.currencyId) }
    })),
    weekdays
  });
}

module.exports = { buildNetwork, getNetwork };
