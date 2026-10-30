/** @format */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create ticketmeta table
      await queryInterface.createTable(
        'ticketmeta',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          meta_key: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: true,
            comment:
              "Unique identifier for the meta type (e.g., 'ticket_status_paid')"
          },
          meta_type: {
            type: Sequelize.ENUM(
              'ticket_status',
              'ticket_type',
              'confirmation_type'
            ),
            allowNull: false,
            comment: 'Category of the metadata (status, type, confirmation)'
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Whether this meta option is currently active'
          },
          sort_order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'For ordering options in UI'
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal(
              'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            )
          }
        },
        {
          transaction,
          comment: 'Flexible metadata system for tickets and passenger tickets'
        }
      );

      // Add indexes for better performance
      await queryInterface.addIndex('ticketmeta', ['meta_type'], {
        name: 'idx_ticketmeta_type',
        transaction
      });

      await queryInterface.addIndex('ticketmeta', ['meta_key', 'meta_type'], {
        name: 'idx_ticketmeta_key_type',
        transaction
      });

      await queryInterface.addIndex('ticketmeta', ['is_active'], {
        name: 'idx_ticketmeta_active',
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
      await queryInterface.dropTable('ticketmeta', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
