'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    const dialect = queryInterface.sequelize.options.dialect;

    try {
      const tickets = await queryInterface.sequelize.query(
        'SELECT id, children FROM tickets WHERE children IS NOT NULL',
        { type: QueryTypes.SELECT, transaction }
      );

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      for (const ticket of tickets) {
        const children =
          typeof ticket.children === 'string'
            ? JSON.parse(ticket.children)
            : ticket.children;

        const entries = Object.entries(children || {});
        if (entries.length === 0) continue;

        for (const [key, child] of entries) {
          const n = key.split('-').pop(); // "child-passenger-1" → "1"

          const name = child[`name-${n}`] || '';
          const lastName = child[`last-name-${n}`] || '';
          const dobRaw = child[`date-of-birth-${n}`];
          const dateOfBirth = dobRaw
            ? new Date(Number(dobRaw)).toISOString().slice(0, 10)
            : null;
          // Handle the "percantage" typo that exists in some real records
          const discountPercentage =
            child[`discount-percentage-${n}`] ??
            child[`discount-percantage-${n}`] ??
            null;
          // "0" is a sentinel in the old JSON meaning "no discount" — treat as null
          const rawDiscountId = child[`discount-${n}`];
          const passengerDiscountId =
            rawDiscountId && rawDiscountId !== '0' ? rawDiscountId : null;
          const pdfFileName = child.pdfFileName || null;

          // Idempotency guard: skip a child already migrated for this ticket, so
          // re-running this migration (e.g. after a rename — which is exactly
          // what duplicated children on staging) never inserts duplicates.
          const dupeCheckSql =
            dialect === 'postgres'
              ? `SELECT pt.id FROM passengertickets pt
                 JOIN passengers p ON p.id = pt."passengerId"
                 WHERE pt."ticketId" = $1 AND p.type = 'child' AND p.name = $2
                   AND p."lastName" = $3
                   AND (p."dateOfBirth" = $4 OR (p."dateOfBirth" IS NULL AND $4 IS NULL))
                 LIMIT 1`
              : `SELECT pt.id FROM passengertickets pt
                 JOIN passengers p ON p.id = pt.passengerId
                 WHERE pt.ticketId = ? AND p.type = 'child' AND p.name = ?
                   AND p.lastName = ?
                   AND (p.dateOfBirth = ? OR (p.dateOfBirth IS NULL AND ? IS NULL))
                 LIMIT 1`;
          const alreadyMigrated = await queryInterface.sequelize.query(
            dupeCheckSql,
            {
              ...(dialect === 'postgres'
                ? { bind: [ticket.id, name, lastName, dateOfBirth] }
                : {
                    replacements: [
                      ticket.id,
                      name,
                      lastName,
                      dateOfBirth,
                      dateOfBirth
                    ]
                  }),
              type: QueryTypes.SELECT,
              transaction
            }
          );
          if (alreadyMigrated.length) continue;

          let passengerId;

          if (dialect === 'postgres') {
            const rows = await queryInterface.sequelize.query(
              `INSERT INTO passengers (name, "lastName", phone, "dateOfBirth", type, "createdAt", "updatedAt")
               VALUES ($1, $2, NULL, $3, 'child', $4, $5)
               RETURNING id`,
              {
                bind: [name, lastName, dateOfBirth, now, now],
                type: QueryTypes.SELECT,
                transaction
              }
            );
            passengerId = rows[0].id;
          } else {
            const [id] = await queryInterface.sequelize.query(
              `INSERT INTO passengers (name, lastName, phone, dateOfBirth, type, createdAt, updatedAt)
               VALUES (?, ?, NULL, ?, 'child', ?, ?)`,
              {
                replacements: [name, lastName, dateOfBirth, now, now],
                type: QueryTypes.INSERT,
                transaction
              }
            );
            passengerId = id;
          }

          if (dialect === 'postgres') {
            await queryInterface.sequelize.query(
              `INSERT INTO passengertickets ("ticketId", "passengerId", "passengerDiscountId", "discountPercentage", "PDFFileName", "paymentAtOffice", "paymentOnBus", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, $7)`,
              {
                bind: [
                  ticket.id,
                  passengerId,
                  passengerDiscountId,
                  discountPercentage,
                  pdfFileName,
                  now,
                  now
                ],
                type: QueryTypes.INSERT,
                transaction
              }
            );
          } else {
            await queryInterface.sequelize.query(
              `INSERT INTO passengertickets (ticketId, passengerId, passengerDiscountId, discountPercentage, PDFFileName, paymentAtOffice, paymentOnBus, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
              {
                replacements: [
                  ticket.id,
                  passengerId,
                  passengerDiscountId,
                  discountPercentage,
                  pdfFileName,
                  now,
                  now
                ],
                type: QueryTypes.INSERT,
                transaction
              }
            );
          }
        }
      }

      // Backfill passengerRowCount for every ticket (adults already in table + newly inserted children)
      await queryInterface.sequelize.query(
        `UPDATE tickets t
         SET ${dialect === 'postgres' ? '"passengerRowCount"' : 'passengerRowCount'} = (
           SELECT COUNT(*) FROM passengertickets pt WHERE pt.${dialect === 'postgres' ? '"ticketId"' : 'ticketId'} = t.id
         )`,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    const dialect = queryInterface.sequelize.options.dialect;

    try {
      if (dialect === 'postgres') {
        await queryInterface.sequelize.query(
          `DELETE FROM passengertickets
           WHERE "passengerId" IN (SELECT id FROM passengers WHERE type = 'child')`,
          { transaction }
        );
      } else {
        await queryInterface.sequelize.query(
          `DELETE pt FROM passengertickets pt
           JOIN passengers p ON p.id = pt.passengerId
           WHERE p.type = 'child'`,
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        "DELETE FROM passengers WHERE type = 'child'",
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE tickets SET ${dialect === 'postgres' ? '"passengerRowCount"' : 'passengerRowCount'} = 0`,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
