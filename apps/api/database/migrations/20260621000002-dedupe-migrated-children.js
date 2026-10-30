'use strict';

const { QueryTypes } = require('sequelize');

/**
 * Repairs duplicate child rows produced when the children-JSON migration ran
 * twice on an environment. The migration file was renamed (20260318 → 20260602)
 * so Sequelize re-ran it and re-inserted every child from the still-present
 * tickets.children JSON, creating a second passenger + passengerticket per
 * child (~456 rows across ~390 tickets on staging).
 *
 * For each (ticketId + child identity) group with more than one row, the
 * earliest passengerticket row is kept and the rest — plus their now-orphaned
 * child passenger records — are deleted. Each affected ticket then has its
 * passengerRowCount and price recomputed (price = sum of the remaining
 * passengers' prices, which removes the double-counted amount).
 *
 * Idempotent: after de-duplication there are no excess rows, so a re-run, and a
 * run on an environment that only migrated children once (e.g. production), is
 * a no-op.
 */
module.exports = {
  up: async (queryInterface) => {
    const dialect = queryInterface.sequelize.options.dialect;
    const col = (pg, my) => (dialect === 'postgres' ? pg : my);
    const passengerId = col('"passengerId"', 'passengerId');
    const ticketId = col('"ticketId"', 'ticketId');
    const lastName = col('"lastName"', 'lastName');
    const dateOfBirth = col('"dateOfBirth"', 'dateOfBirth');
    const passengerRowCount = col('"passengerRowCount"', 'passengerRowCount');

    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Excess = every child passengerticket that is NOT the earliest (MIN id)
      // row of its (ticket, name, lastName, dateOfBirth) group. Single-row
      // groups keep their only row (it is the MIN), so only true duplicates are
      // selected here.
      const excess = await queryInterface.sequelize.query(
        `SELECT pt.id AS ptId, pt.${passengerId} AS passengerId, pt.${ticketId} AS ticketId
         FROM passengertickets pt
         JOIN passengers p ON p.id = pt.${passengerId}
         WHERE p.type = 'child'
           AND pt.id NOT IN (
             SELECT keepId FROM (
               SELECT MIN(pt2.id) AS keepId
               FROM passengertickets pt2
               JOIN passengers p2 ON p2.id = pt2.${passengerId}
               WHERE p2.type = 'child'
               GROUP BY pt2.${ticketId}, p2.name, p2.${lastName}, p2.${dateOfBirth}
             ) k
           )`,
        { type: QueryTypes.SELECT, transaction }
      );

      if (excess.length) {
        const ptIds = excess.map((r) => r.ptId);
        const orphanPassengerIds = [
          ...new Set(excess.map((r) => r.passengerId))
        ];
        const ticketIds = [...new Set(excess.map((r) => r.ticketId))];

        // 1. Delete the duplicate passengerticket rows.
        await queryInterface.sequelize.query(
          `DELETE FROM passengertickets WHERE id IN (${ptIds.join(',')})`,
          { transaction }
        );

        // 2. Delete the child passenger records orphaned by that delete
        //    (guarded so a still-referenced passenger is never removed).
        await queryInterface.sequelize.query(
          `DELETE FROM passengers
           WHERE id IN (${orphanPassengerIds.join(',')})
             AND type = 'child'
             AND id NOT IN (SELECT ${passengerId} FROM passengertickets)`,
          { transaction }
        );

        // 3. Resync passengerRowCount and price for each affected ticket.
        for (const id of ticketIds) {
          await queryInterface.sequelize.query(
            `UPDATE tickets SET ${passengerRowCount} =
               (SELECT COUNT(*) FROM passengertickets WHERE ${ticketId} = ${id})
             WHERE id = ${id}`,
            { transaction }
          );
          await queryInterface.sequelize.query(
            `UPDATE tickets SET price =
               COALESCE((SELECT SUM(price) FROM passengertickets WHERE ${ticketId} = ${id}), 0)
             WHERE id = ${id}`,
            { transaction }
          );
        }
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  // Data repair — the removed duplicate rows cannot be meaningfully recreated.
  down: async () => {}
};
