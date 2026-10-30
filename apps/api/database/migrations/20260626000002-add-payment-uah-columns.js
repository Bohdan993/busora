'use strict';

/**
 * Makes UAH the stored truth for the per-passenger payment amounts.
 *
 * The admin works entirely in UAH (enters, sees, sorts in UAH), but a ticket is
 * stored in its booking currency (EUR for DE-origin, UAH for UA-origin) so the
 * customer-facing price/PDF stay in that currency. Previously the UAH payment
 * values were derived on read (paymentAtOffice × rate), which made editing in
 * UAH round-trip with rounding drift. This adds real UAH columns so the admin's
 * typed UAH persists exactly; the booking-currency columns become the derived
 * side (round(UAH / rate)).
 *
 *   - passengertickets.paymentAtOfficeUAH : amount paid at office, in UAH (truth)
 *   - passengertickets.paymentOnBusUAH    : amount paid on bus, in UAH (truth)
 *
 * Backfill: UAH = round(payment × tickets.exchangeRate) using the rate already
 * locked by 20260626000001 (1 for UAH tickets → unchanged; historical rate for
 * EUR). NULL payments stay NULL. Idempotent: re-running recomputes the same
 * values from the (unchanged) booking-currency columns.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    const pcols = await queryInterface.describeTable('passengertickets');
    if (!pcols.paymentAtOfficeUAH) {
      await queryInterface.addColumn('passengertickets', 'paymentAtOfficeUAH', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Amount paid at office, in UAH (admin truth); paymentAtOffice = round(this / exchangeRate).'
      });
    }
    if (!pcols.paymentOnBusUAH) {
      await queryInterface.addColumn('passengertickets', 'paymentOnBusUAH', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Amount paid on bus, in UAH (admin truth); paymentOnBus = round(this / exchangeRate).'
      });
    }

    // Backfill from the booking-currency columns × the ticket's locked rate.
    // CAST handles the varchar payment columns; NULL payments → NULL (untouched).
    await sequelize.query(
      'UPDATE passengertickets pt ' +
        'JOIN tickets t ON t.id = pt.ticketId ' +
        'SET pt.paymentAtOfficeUAH = ROUND(' +
        '  CAST(pt.paymentAtOffice AS DECIMAL(15,2)) * COALESCE(t.exchangeRate, 1)' +
        '), pt.paymentOnBusUAH = ROUND(' +
        '  CAST(pt.paymentOnBus AS DECIMAL(15,2)) * COALESCE(t.exchangeRate, 1)' +
        ')'
    );
  },

  down: async (queryInterface) => {
    for (const column of ['paymentAtOfficeUAH', 'paymentOnBusUAH']) {
      const cols = await queryInterface.describeTable('passengertickets');
      if (cols[column]) {
        await queryInterface.removeColumn('passengertickets', column);
      }
    }
  }
};
