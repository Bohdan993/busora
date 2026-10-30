/** @format */

'use strict';
const constants = require('@helpers/constants.js');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('discounts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true,
        allowNull: false
      },
      coef: {
        type: Sequelize.FLOAT(3, 2),
        allowNull: false
      },
      group: {
        type: Sequelize.ENUM,
        values: [
          constants.ADULTS,
          constants.CHILDREN,
          constants.BOTH,
          constants.BUS_FLIGHT,
          constants.DISCOUNT_CARD
        ],
        defaultValue: constants.ADULTS,
        allowNull: false
      },
      inactivePeriod: {
        type: Sequelize.STRING(11),
        allowNull: true,
        defaultValue: null
      },
      maxAge: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      minAge: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 500
      },
      busFlightId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'busflights', // Make sure to use the actual table name for BusFlightModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add any additional logic for associations or indexes here, if needed
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the table if migration needs to be rolled back
    await queryInterface.dropTable('discounts');
  }
};
