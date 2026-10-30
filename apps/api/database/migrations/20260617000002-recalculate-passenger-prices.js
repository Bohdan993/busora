'use strict';

/**
 * Backfills per-passenger `price` and `paymentAtOffice` for existing tickets,
 * using `tickets.price` (the authoritative total) as the single source of truth.
 *
 * IMPORTANT — do NOT derive prices from the legacy paymentAtOffice/paymentOnBus
 * columns. For many old tickets those hold unreliable values (a small amount, or
 * a foreign-currency figure against a UAH total). An earlier version of this
 * migration trusted them and recomputed price = payment × discount, which
 * produced tiny prices AND overwrote tickets.price with the wrong sum —
 * corrupting real totals (e.g. ticket 005158: 5206 UAH → 76 UAH, from a stale
 * paymentAtOffice ≈ 101). Instead:
 *
 * - Each ticket's price is distributed across its passengers weighted by their
 *   discount multiplier, so SUM(passengertickets.price) == tickets.price exactly.
 * - The last row absorbs the rounding remainder so the sum is exact.
 * - tickets.price itself is NEVER overwritten (it is the truth).
 * - paymentAtOffice is backfilled (grossed up by the applied discount) ONLY for
 *   rows that have no payment recorded yet; rows that already carry a payment
 *   value are left untouched.
 *
 * Idempotent: re-running redistributes the same total and re-skips rows that
 * already have a payment.
 */
module.exports = {
  up: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;

    const [discounts] = await sequelize.query('SELECT id, coef FROM discounts');
    const coefById = {};
    for (const d of discounts) coefById[d.id] = Number(d.coef) || 0;

    const [tickets] = await sequelize.query(
      'SELECT id, price, discountPercentage FROM tickets'
    );

    for (const ticket of tickets) {
      const [rows] = await sequelize.query(
        `SELECT id, paymentAtOffice, paymentOnBus, passengerDiscountId
         FROM passengertickets WHERE ticketId = ${ticket.id} ORDER BY id ASC`
      );
      if (!rows.length) continue;

      const ticketPct = Number(ticket.discountPercentage) || 0;
      const P = Number(ticket.price) || 0;

      // Per-passenger discount multiplier. A ticket-level discount overrides the
      // passenger's own discount; otherwise use the passenger's discount coef.
      const multOf = (row) => {
        const pct =
          ticketPct > 0
            ? ticketPct
            : (coefById[row.passengerDiscountId] || 0) * 100;
        return 1 - pct / 100;
      };

      const totalMult = rows.reduce((sum, r) => sum + multOf(r), 0);
      // Common gross per passenger so that Σ(gross × mult) == P.
      const gross = totalMult > 0 ? P / totalMult : P / rows.length;

      let assigned = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mult = multOf(row);
        // Last row absorbs the rounding remainder so the sum is exactly P.
        const price =
          i === rows.length - 1 ? P - assigned : Math.round(gross * mult);
        assigned += price;

        await sequelize.query(
          `UPDATE passengertickets SET price = ${price} WHERE id = ${row.id}`
        );

        // Backfill paymentAtOffice only when nothing was recorded yet, so we
        // never clobber a real payment value.
        const bothNull =
          (row.paymentAtOffice === null || row.paymentAtOffice === undefined) &&
          (row.paymentOnBus === null || row.paymentOnBus === undefined);
        if (bothNull) {
          const payAtOffice =
            mult > 0 ? Math.round(price / mult) : Math.round(price);
          await sequelize.query(
            `UPDATE passengertickets SET paymentAtOffice = ${payAtOffice} WHERE id = ${row.id}`
          );
        }
      }
      // tickets.price is the source of truth — intentionally never overwritten.
    }
  },

  // Data backfill; the previous values are not meaningfully recoverable.
  down: async () => {}
};
