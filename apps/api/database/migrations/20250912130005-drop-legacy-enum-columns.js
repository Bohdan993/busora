/** @format */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('Starting removal of legacy ENUM columns...');

      // Verify that all records have been migrated to the new meta system
      const unmappedTickets = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM tickets WHERE (statusId IS NULL OR typeId IS NULL)`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      const unmappedPassengerTickets = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM passengertickets WHERE confirmation IS NOT NULL AND confirmationId IS NULL`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      if (unmappedTickets[0].count > 0) {
        throw new Error(
          `Found ${unmappedTickets[0].count} tickets with unmapped status or type. Please run the data migration first.`
        );
      }

      if (unmappedPassengerTickets[0].count > 0) {
        throw new Error(
          `Found ${unmappedPassengerTickets[0].count} passenger tickets with unmapped confirmation. Please run the data migration first.`
        );
      }

      console.log(
        'All data successfully migrated. Proceeding with column removal...'
      );

      // Drop the legacy ENUM columns from tickets table
      await queryInterface.removeColumn('tickets', 'type', { transaction });
      console.log("✓ Dropped 'type' column from tickets table");

      await queryInterface.removeColumn('tickets', 'status', { transaction });
      console.log("✓ Dropped 'status' column from tickets table");

      // Drop the legacy ENUM column from passengertickets table
      await queryInterface.removeColumn('passengertickets', 'confirmation', {
        transaction
      });
      console.log(
        "✓ Dropped 'confirmation' column from passengertickets table"
      );

      // Make the new foreign key columns NOT NULL to ensure data integrity
      // (only for statusId and typeId as they should always have values)
      await queryInterface.changeColumn(
        'tickets',
        'statusId',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'ticketmeta',
            key: 'id'
          },
          comment: 'Reference to ticket status in ticketmeta table'
        },
        { transaction }
      );
      console.log('✓ Made statusId NOT NULL in tickets table');

      await queryInterface.changeColumn(
        'tickets',
        'typeId',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'ticketmeta',
            key: 'id'
          },
          comment: 'Reference to ticket type in ticketmeta table'
        },
        { transaction }
      );
      console.log('✓ Made typeId NOT NULL in tickets table');

      // confirmationId remains nullable as it's optional

      await transaction.commit();
      console.log(
        '✅ Successfully removed all legacy ENUM columns and enforced NOT NULL constraints'
      );
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Failed to remove legacy ENUM columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('Rolling back: Recreating legacy ENUM columns...');

      // Recreate the ENUM columns
      await queryInterface.addColumn(
        'tickets',
        'type',
        {
          type: Sequelize.ENUM('one-way', 'round', 'open-date'),
          allowNull: true // Make nullable during rollback
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'tickets',
        'status',
        {
          type: Sequelize.ENUM('not-payed', 'payed', 'half-used', 'used'),
          allowNull: true // Make nullable during rollback
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'passengertickets',
        'confirmation',
        {
          type: Sequelize.ENUM('confirmation', 'date-transfer', 'refusal'),
          allowNull: true
        },
        { transaction }
      );

      // Make the foreign key columns nullable again
      await queryInterface.changeColumn(
        'tickets',
        'statusId',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'ticketmeta',
            key: 'id'
          }
        },
        { transaction }
      );

      await queryInterface.changeColumn(
        'tickets',
        'typeId',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'ticketmeta',
            key: 'id'
          }
        },
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Successfully rolled back ENUM column removal');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Failed to rollback ENUM column removal:', error);
      throw error;
    }
  }
};
