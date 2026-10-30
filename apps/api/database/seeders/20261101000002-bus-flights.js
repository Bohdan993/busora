/** @format */

'use strict';

// Daily departures on every route for the next SCHEDULE_DAYS days, counted
// from the day the seeder runs, plus a promotional discount on some of them.
// Re-run it to move the schedule forward:
//   npx sequelize-cli db:seed:undo --seed 20261101000002-bus-flights.js
//   npx sequelize-cli db:seed --seed 20261101000002-bus-flights.js

const { PROMO_DISCOUNT } = require('./data/network');
const { localizedRows, flightRows } = require('./data/buildRows');

const PROMO_GROUP = 'bus-flights';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();
      await queryInterface.bulkInsert(
        'busflights',
        flightRows(new Date()).map((row) => ({
          ...row,
          createdAt: now,
          updatedAt: now
        })),
        { transaction }
      );

      const flights = await queryInterface.sequelize.query(
        'SELECT id, dateOfDeparture FROM busflights WHERE routeId IN (:routeIds)',
        {
          replacements: { routeIds: PROMO_DISCOUNT.routeIds },
          type: Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const promoFlights = flights.filter(
        ({ dateOfDeparture }) =>
          new Date(`${dateOfDeparture}T00:00:00Z`).getUTCDay() ===
          PROMO_DISCOUNT.weekday
      );

      for (const flight of promoFlights) {
        const [discountId] = await queryInterface.sequelize.query(
          'INSERT INTO discounts (coef, `group`, `order`, busFlightId, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())',
          {
            replacements: [
              PROMO_DISCOUNT.coef,
              PROMO_GROUP,
              PROMO_DISCOUNT.order,
              flight.id
            ],
            type: Sequelize.QueryTypes.INSERT,
            transaction
          }
        );
        await queryInterface.bulkInsert(
          'discountattributes',
          localizedRows('discountId', discountId, PROMO_DISCOUNT.names).map(
            (row) => ({ ...row, createdAt: now, updatedAt: now })
          ),
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'DELETE da FROM discountattributes da JOIN discounts d ON d.id = da.discountId WHERE d.`group` = ?',
        { replacements: [PROMO_GROUP], transaction }
      );
      await queryInterface.bulkDelete(
        'discounts',
        { group: PROMO_GROUP },
        { transaction }
      );
      await queryInterface.bulkDelete('busflights', null, { transaction });
    });
  }
};
