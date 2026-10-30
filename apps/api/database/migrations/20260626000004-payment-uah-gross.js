'use strict';

/**
 * Sets paymentAtOfficeUAH / paymentOnBusUAH to the GROSS (pre-discount) fare in
 * UAH — the system's definition of the office/on-bus payment.
 *
 * Per the admin pricing formula `price = (paymentAtOffice + paymentOnBus) ×
 * (1 - discount)`, paymentAtOffice is the gross fare and `price` is the net
 * charged, so with a discount paymentAtOffice MUST be greater than price. The
 * earlier backfills left the UAH columns either net (= priceUAH) or in euros, so
 * discounted tickets wrongly showed paymentAtOfficeUAH == priceUAH.
 *
 * This recomputes the UAH columns purely from the reliable `priceUAH` (the net,
 * already canonical UAH) and the per-passenger discount multiplier — the SAME
 * formula and discount precedence the recalc migration uses (a ticket-level
 * discount overrides the passenger's own discount). It therefore supersedes the
 * 0002 backfill and the 0003 DE fix, and is correct for both UA and DE tickets:
 *
 *   mult = 1 - (ticket.discountPercentage>0 ? ticket.discountPercentage/100
 *                                           : discounts.coef)
 *   paymentAtOfficeUAH = round(priceUAH / mult)   // = priceUAH when no discount
 *
 * The whichever-field-is-used rule mirrors the data: the full amount sits in
 * paymentAtOffice (paymentOnBus is used only when paymentAtOffice is null).
 * Idempotent; mult is clamped >0 so a 100% discount is skipped. No-discount rows
 * are unchanged (mult=1). The booking-currency columns are left as legacy values
 * (the admin reads the UAH columns; an edit re-derives them from the UAH truth).
 */

// SQL fragment for the per-passenger net→gross multiplier (ticket discount wins).
const MULT =
  '(1 - (CASE WHEN COALESCE(t.discountPercentage,0) > 0 ' +
  'THEN t.discountPercentage/100 ELSE COALESCE(d.coef,0) END))';

module.exports = {
  up: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;

    // Office payment is the gross fare for every ticket that records it.
    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      LEFT JOIN discounts d ON d.id = pt.passengerDiscountId
      SET pt.paymentAtOfficeUAH = ROUND(pt.priceUAH / ${MULT})
      WHERE pt.priceUAH IS NOT NULL
        AND pt.paymentAtOffice IS NOT NULL
        AND ${MULT} > 0
    `);

    // On-bus payment carries the gross only when it is the field in use.
    await sequelize.query(`
      UPDATE passengertickets pt
      JOIN tickets t ON t.id = pt.ticketId
      LEFT JOIN discounts d ON d.id = pt.passengerDiscountId
      SET pt.paymentOnBusUAH = ROUND(pt.priceUAH / ${MULT})
      WHERE pt.priceUAH IS NOT NULL
        AND pt.paymentAtOffice IS NULL
        AND pt.paymentOnBus IS NOT NULL
        AND ${MULT} > 0
    `);
  },

  // Revert to the net value (= priceUAH), the post-0003 state for these columns.
  down: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      UPDATE passengertickets pt
      SET pt.paymentAtOfficeUAH = pt.priceUAH
      WHERE pt.priceUAH IS NOT NULL AND pt.paymentAtOffice IS NOT NULL
    `);
    await sequelize.query(`
      UPDATE passengertickets pt
      SET pt.paymentOnBusUAH = pt.priceUAH
      WHERE pt.priceUAH IS NOT NULL
        AND pt.paymentAtOffice IS NULL AND pt.paymentOnBus IS NOT NULL
    `);
  }
};
