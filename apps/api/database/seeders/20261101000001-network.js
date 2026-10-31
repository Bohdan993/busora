/** @format */

'use strict';

// Reference data of the Ukraine ⇄ Czech Republic demo network: currencies,
// countries, cities and their stops, routes, fares, passenger discounts and
// booking agents. See data/network.js.

const {
  CURRENCIES,
  COUNTRIES,
  CITIES,
  LINES,
  PASSENGER_DISCOUNTS,
  AGENTS
} = require('./data/network');
const {
  localizedRows,
  routeRows,
  routeCityOrderRows,
  priceRows
} = require('./data/buildRows');

const withTimestamps = (rows) => {
  const now = new Date();
  return rows.map((row) => ({ ...row, createdAt: now, updatedAt: now }));
};

const localized = (foreignKey, items, namesOf = (item) => item.names) =>
  items.flatMap((item) => localizedRows(foreignKey, item.id, namesOf(item)));

const routeDirections = LINES.flatMap((line) => [line.outbound, line.inbound]);

// Children before parents on delete
const TABLES_IN_DELETE_ORDER = [
  'agentattributes',
  'agents',
  'discountattributes',
  'discounts',
  'busflightprices',
  'routecityorders',
  'routeattributes',
  'routes',
  'placeattributes',
  'places',
  'cityattributes',
  'cities',
  'countryattributes',
  'countries',
  'currencies'
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const insert = (table, rows) =>
        queryInterface.bulkInsert(table, withTimestamps(rows), {
          transaction
        });

      await insert('currencies', CURRENCIES);
      await insert(
        'countries',
        COUNTRIES.map(({ id }) => ({ id }))
      );
      await insert('countryattributes', localized('countryId', COUNTRIES));

      await insert(
        'cities',
        CITIES.map(({ id, countryId }) => ({
          id,
          countryId,
          currencyId: COUNTRIES.find((c) => c.id === countryId).currencyId
        }))
      );
      await insert('cityattributes', localized('cityId', CITIES));
      await insert(
        'places',
        CITIES.map(({ id }) => ({ id, cityId: id }))
      );
      await insert(
        'placeattributes',
        localized('placeId', CITIES, (city) => city.place)
      );

      await insert('routes', routeRows());
      await insert(
        'routeattributes',
        localized(
          'routeId',
          routeDirections.map((d) => ({ id: d.routeId, names: d.names }))
        )
      );
      await insert('routecityorders', routeCityOrderRows());
      await insert('busflightprices', priceRows());

      await insert(
        'discounts',
        PASSENGER_DISCOUNTS.map(
          ({ id, coef, group, minAge, maxAge, inactivePeriod, order }) => ({
            id,
            coef,
            group,
            minAge: minAge ?? null,
            maxAge: maxAge ?? null,
            inactivePeriod: inactivePeriod ?? null,
            order
          })
        )
      );
      await insert(
        'discountattributes',
        localized('discountId', PASSENGER_DISCOUNTS)
      );

      await insert(
        'agents',
        AGENTS.map(({ id }) => ({ id }))
      );
      await insert('agentattributes', localized('agentId', AGENTS));
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of TABLES_IN_DELETE_ORDER) {
        await queryInterface.bulkDelete(table, null, { transaction });
      }
    });
  }
};
