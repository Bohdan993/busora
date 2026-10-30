'use strict';

/**
 * Adds a per-passenger `price` column to `passengertickets`. Going forward the
 * ticket-level `price` is a calculated value: the sum of its passengers' prices
 * ((paymentAtOffice + paymentOnBus) × discount multiplier).
 *
 * To preserve that invariant for existing data, each ticket's current price is
 * distributed across its passenger rows (even split, remainder on the last row)
 * so that SUM(passengertickets.price) == tickets.price after the backfill.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('passengertickets');
    if (!columns.price) {
      await queryInterface.addColumn('passengertickets', 'price', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Per-passenger calculated price; tickets.price is the sum of these.'
      });
    }

    // Backfill: distribute each ticket's price across its passenger rows.
    const [tickets] = await queryInterface.sequelize.query(
      'SELECT id, price FROM tickets'
    );

    for (const ticket of tickets) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM passengertickets WHERE ticketId = ${ticket.id} ORDER BY id ASC`
      );
      if (!rows.length) continue;

      const total = Number(ticket.price) || 0;
      const per = Math.floor(total / rows.length);
      let assigned = 0;

      for (let i = 0; i < rows.length; i++) {
        const value = i === rows.length - 1 ? total - assigned : per;
        assigned += value;
        await queryInterface.sequelize.query(
          `UPDATE passengertickets SET price = ${value} WHERE id = ${rows[i].id}`
        );
      }
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('passengertickets');
    if (columns.price) {
      await queryInterface.removeColumn('passengertickets', 'price');
    }
  }
};
