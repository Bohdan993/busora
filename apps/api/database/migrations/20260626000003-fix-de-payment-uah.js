'use strict';

/**
 * Corrects paymentAtOfficeUAH / paymentOnBusUAH for DE-origin tickets.
 *
 * Production stores every ticket as currencyAbbr = "UAH" with `price` in UAH
 * (LiqPay always charges UAH), BUT for tickets departing Germany the legacy
 * `paymentAtOffice` / `paymentOnBus` columns hold the **EUR** amount, not UAH.
 * The 20260626000002 backfill assumed those columns matched the ticket's
 * currency and multiplied by exchangeRate (= 1 for UAH tickets), so it left the
 * UAH columns holding euros (e.g. 108 instead of ~5567).
 *
 * Since the system has no partial payments, the office (or on-bus) payment IS
 * the full per-passenger price — so its UAH value is exactly the already-correct
 * `priceUAH`. No historical-rate lookup needed; set the UAH column = priceUAH.
 *
 * Scope guard: only rows where the origin country is Germany (id 2) AND the
 * stored payment is clearly EUR-magnitude (priceUAH is >10× the payment), so a
 * DE-origin row that already holds a UAH payment is never touched. Idempotent.
 */

const DE_COUNTRY_ID = 2;
const EUR_MAGNITUDE_RATIO = 10; // priceUAH / payment > this ⇒ payment is in EUR

module.exports = {
  up: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;

    // paymentAtOffice (the usual field) — set its UAH column to the price in UAH.
    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      JOIN cities c ON c.id = t.originId
      SET pt.paymentAtOfficeUAH = pt.priceUAH
      WHERE c.countryId = ${DE_COUNTRY_ID}
        AND pt.priceUAH IS NOT NULL
        AND pt.paymentAtOffice IS NOT NULL
        AND pt.priceUAH / NULLIF(CAST(pt.paymentAtOffice AS DECIMAL(15,2)), 0) > ${EUR_MAGNITUDE_RATIO}
    `);

    // paymentOnBus (rare) — same correction when it is the EUR-denominated field.
    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      JOIN cities c ON c.id = t.originId
      SET pt.paymentOnBusUAH = pt.priceUAH
      WHERE c.countryId = ${DE_COUNTRY_ID}
        AND pt.priceUAH IS NOT NULL
        AND pt.paymentOnBus IS NOT NULL
        AND pt.priceUAH / NULLIF(CAST(pt.paymentOnBus AS DECIMAL(15,2)), 0) > ${EUR_MAGNITUDE_RATIO}
    `);
  },

  // Restore the (incorrect) 20260626000002 state: UAH = payment × exchangeRate.
  down: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      JOIN cities c ON c.id = t.originId
      SET pt.paymentAtOfficeUAH = ROUND(
            CAST(pt.paymentAtOffice AS DECIMAL(15,2)) * COALESCE(t.exchangeRate, 1)
          )
      WHERE c.countryId = ${DE_COUNTRY_ID} AND pt.paymentAtOffice IS NOT NULL
    `);
    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      JOIN cities c ON c.id = t.originId
      SET pt.paymentOnBusUAH = ROUND(
            CAST(pt.paymentOnBus AS DECIMAL(15,2)) * COALESCE(t.exchangeRate, 1)
          )
      WHERE c.countryId = ${DE_COUNTRY_ID} AND pt.paymentOnBus IS NOT NULL
    `);
  }
};
