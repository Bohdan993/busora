'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create ticketmetaattributes table for localized values
      await queryInterface.createTable(
        'ticketmetaattributes',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          metaId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: 'ticketmeta',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          languageId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: 'languages',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          name: {
            type: Sequelize.STRING(255),
            allowNull: false,
            comment: 'Localized display name for the meta value'
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Optional detailed description in the specified language'
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
          comment: 'Localized attributes for ticket metadata'
        }
      );

      // Add unique constraint to ensure one translation per meta per language
      await queryInterface.addConstraint('ticketmetaattributes', {
        fields: ['metaId', 'languageId'],
        type: 'unique',
        name: 'uk_ticketmetaattributes_meta_lang',
        transaction
      });

      // Add indexes for better performance
      await queryInterface.addIndex('ticketmetaattributes', ['metaId'], {
        name: 'idx_ticketmetaattributes_meta',
        transaction
      });

      await queryInterface.addIndex('ticketmetaattributes', ['languageId'], {
        name: 'idx_ticketmetaattributes_lang',
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
      await queryInterface.dropTable('ticketmetaattributes', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
