'use strict';

/**
 * Grosses up the booking-currency paymentAtOffice / paymentOnBus columns to the
 * pre-discount fare — completing what 20260626000004 did for the UAH columns.
 *
 * Model (confirmed): paymentAtOffice is the GROSS fare and price is the net the
 * customer paid, with price = paymentAtOffice × (1 - discount). The legacy data
 * stored paymentAtOffice equal to the net price, so editing a discounted ticket
 * re-applied the discount (price = paymentAtOffice × (1-disc)) and shrank the
 * price every save. 0004 fixed paymentAtOfficeUAH; this fixes the booking column
 * so BOTH representations are the fare and the edit round-trip is idempotent
 * regardless of which field the client sends.
 *
 *   mult = 1 - (ticket.discountPercentage>0 ? ticket.discountPercentage/100
 *                                           : discounts.coef)
 *   paymentAtOffice = round(price / mult)            // = price when no discount
 *
 * Derived from the net `price`, so it requires a CLEAN price (i.e. a fresh
 * re-seed where no ticket was edited mid-migration). Idempotent; mult clamped >0;
 * no-discount rows unchanged.
 */

const MULT =
  '(1 - (CASE WHEN COALESCE(t.discountPercentage,0) > 0 ' +
  'THEN t.discountPercentage/100 ELSE COALESCE(d.coef,0) END))';

module.exports = {
  up: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      LEFT JOIN discounts d ON d.id = pt.passengerDiscountId
      SET pt.paymentAtOffice = ROUND(pt.price / ${MULT})
      WHERE pt.price IS NOT NULL
        AND pt.paymentAtOffice IS NOT NULL
        AND ${MULT} > 0
    `);

    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      LEFT JOIN discounts d ON d.id = pt.passengerDiscountId
      SET pt.paymentOnBus = ROUND(pt.price / ${MULT})
      WHERE pt.price IS NOT NULL
        AND pt.paymentAtOffice IS NULL
        AND pt.paymentOnBus IS NOT NULL
        AND ${MULT} > 0
    `);
  },

  // Revert to the net value (= price), the pre-gross state for these columns.
  down: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      UPDATE passengertickets pt
      SET pt.paymentAtOffice = pt.price
      WHERE pt.price IS NOT NULL AND pt.paymentAtOffice IS NOT NULL
    `);
    await sequelize.query(`
      UPDATE passengertickets pt
      SET pt.paymentOnBus = pt.price
      WHERE pt.price IS NOT NULL
        AND pt.paymentAtOffice IS NULL AND pt.paymentOnBus IS NOT NULL
    `);
  }
};
