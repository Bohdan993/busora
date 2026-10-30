/** @format */

'use strict';

const constants = require('../../helpers/constants.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get all ticketmeta records for mapping
      const statusMetas = await queryInterface.sequelize.query(
        `SELECT id, meta_key FROM ticketmeta WHERE meta_type = 'ticket_status' ORDER BY sort_order`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      const typeMetas = await queryInterface.sequelize.query(
        `SELECT id, meta_key FROM ticketmeta WHERE meta_type = 'ticket_type' ORDER BY sort_order`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      const confirmationMetas = await queryInterface.sequelize.query(
        `SELECT id, meta_key FROM ticketmeta WHERE meta_type = 'confirmation_type' ORDER BY sort_order`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      // Create mapping objects
      const statusMap = {};
      const typeMap = {};
      const confirmationMap = {};

      statusMetas.forEach((meta) => {
        statusMap[meta.meta_key] = meta.id;
      });

      typeMetas.forEach((meta) => {
        typeMap[meta.meta_key] = meta.id;
      });

      confirmationMetas.forEach((meta) => {
        confirmationMap[meta.meta_key] = meta.id;
      });

      console.log('Status mapping:', statusMap);
      console.log('Type mapping:', typeMap);
      console.log('Confirmation mapping:', confirmationMap);

      // Check if old ENUM columns exist before migrating
      const ticketsTableInfo = await queryInterface.describeTable('tickets');

      if (ticketsTableInfo.status) {
        // Migrate ticket status data
        console.log('Migrating ticket status data...');

        // Update tickets with statusId based on status ENUM
        for (const [enumValue, metaId] of Object.entries(statusMap)) {
          const result = await queryInterface.sequelize.query(
            `UPDATE tickets SET statusId = ? WHERE status = ?`,
            {
              replacements: [metaId, enumValue],
              transaction,
              type: Sequelize.QueryTypes.UPDATE
            }
          );
          console.log(
            `Updated ${result[1]} tickets with status '${enumValue}' to statusId ${metaId}`
          );
        }

        // Set default statusId for any tickets with NULL status
        const defaultStatusId = statusMap[constants.TICKET_STATUS_NOT_PAYED];
        if (defaultStatusId) {
          const nullStatusResult = await queryInterface.sequelize.query(
            `UPDATE tickets SET statusId = ? WHERE status IS NULL AND statusId IS NULL`,
            {
              replacements: [defaultStatusId],
              transaction,
              type: Sequelize.QueryTypes.UPDATE
            }
          );
          console.log(
            `Updated ${nullStatusResult[1]} tickets with NULL status to default statusId ${defaultStatusId}`
          );
        }
      }

      if (ticketsTableInfo.type) {
        // Migrate ticket type data
        console.log('Migrating ticket type data...');

        // Update tickets with typeId based on type ENUM
        for (const [enumValue, metaId] of Object.entries(typeMap)) {
          const result = await queryInterface.sequelize.query(
            `UPDATE tickets SET typeId = ? WHERE type = ?`,
            {
              replacements: [metaId, enumValue],
              transaction,
              type: Sequelize.QueryTypes.UPDATE
            }
          );
          console.log(
            `Updated ${result[1]} tickets with type '${enumValue}' to typeId ${metaId}`
          );
        }

        // Set default typeId for any tickets with NULL type
        const defaultTypeId = typeMap[constants.ONE_WAY];
        if (defaultTypeId) {
          const nullTypeResult = await queryInterface.sequelize.query(
            `UPDATE tickets SET typeId = ? WHERE type IS NULL AND typeId IS NULL`,
            {
              replacements: [defaultTypeId],
              transaction,
              type: Sequelize.QueryTypes.UPDATE
            }
          );
          console.log(
            `Updated ${nullTypeResult[1]} tickets with NULL type to default typeId ${defaultTypeId}`
          );
        }
      }

      // Check passenger tickets table for confirmation column
      const passengerTicketsTableInfo =
        await queryInterface.describeTable('passengertickets');

      if (passengerTicketsTableInfo.confirmation) {
        // Migrate passenger ticket confirmation data
        console.log('Migrating passenger ticket confirmation data...');

        // Update passengertickets with confirmationId based on confirmation ENUM
        for (const [enumValue, metaId] of Object.entries(confirmationMap)) {
          const result = await queryInterface.sequelize.query(
            `UPDATE passengertickets SET confirmationId = ? WHERE confirmation = ?`,
            {
              replacements: [metaId, enumValue],
              transaction,
              type: Sequelize.QueryTypes.UPDATE
            }
          );
          console.log(
            `Updated ${result[1]} passenger tickets with confirmation '${enumValue}' to confirmationId ${metaId}`
          );
        }
      }

      // Make the foreign key columns NOT NULL after migration (for new records)
      // We'll do this in a separate migration to ensure data integrity

      await transaction.commit();
      console.log('Successfully migrated ENUM data to ticketMeta system');
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to migrate ENUM data:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // This rollback assumes ENUM columns still exist
      // In a real scenario, you might want to restore ENUM values from the meta system

      console.log('Rolling back ticketMeta data migration...');

      // Clear the foreign key columns
      await queryInterface.sequelize.query(
        'UPDATE tickets SET statusId = NULL, typeId = NULL',
        { transaction }
      );

      await queryInterface.sequelize.query(
        'UPDATE passengertickets SET confirmationId = NULL',
        { transaction }
      );

      await transaction.commit();
      console.log('Successfully rolled back ticketMeta data migration');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
