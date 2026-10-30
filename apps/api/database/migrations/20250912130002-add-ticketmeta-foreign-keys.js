/** @format */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add statusId column to tickets table
      await queryInterface.addColumn(
        'tickets',
        'statusId',
        {
          type: Sequelize.INTEGER,
          allowNull: true, // Initially null during migration
          references: {
            model: 'ticketmeta',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'Reference to ticket status in ticketmeta table'
        },
        { transaction }
      );

      // Add typeId column to tickets table
      await queryInterface.addColumn(
        'tickets',
        'typeId',
        {
          type: Sequelize.INTEGER,
          allowNull: true, // Initially null during migration
          references: {
            model: 'ticketmeta',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'Reference to ticket type in ticketmeta table'
        },
        { transaction }
      );

      // Add confirmationId column to passengertickets table
      await queryInterface.addColumn(
        'passengertickets',
        'confirmationId',
        {
          type: Sequelize.INTEGER,
          allowNull: true, // Initially null during migration
          references: {
            model: 'ticketmeta',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'Reference to confirmation status in ticketmeta table'
        },
        { transaction }
      );

      // Add indexes for performance
      await queryInterface.addIndex('tickets', ['statusId'], {
        name: 'idx_tickets_status_id',
        transaction
      });

      await queryInterface.addIndex('tickets', ['typeId'], {
        name: 'idx_tickets_type_id',
        transaction
      });

      await queryInterface.addIndex('passengertickets', ['confirmationId'], {
        name: 'idx_passengertickets_confirmation_id',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes
      await queryInterface.removeIndex('tickets', 'idx_tickets_status_id', {
        transaction
      });
      await queryInterface.removeIndex('tickets', 'idx_tickets_type_id', {
        transaction
      });
      await queryInterface.removeIndex(
        'passengertickets',
        'idx_passengertickets_confirmation_id',
        { transaction }
      );

      // Remove columns
      await queryInterface.removeColumn('tickets', 'statusId', { transaction });
      await queryInterface.removeColumn('tickets', 'typeId', { transaction });
      await queryInterface.removeColumn('passengertickets', 'confirmationId', {
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
