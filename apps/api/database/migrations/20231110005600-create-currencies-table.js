'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('currencies', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      abbr: {
        type: Sequelize.STRING(4),
        allowNull: false,
        unique: true
      },
      symbol: {
        type: Sequelize.STRING(3),
        allowNull: false,
        unique: true
      },
      isBaseCurrency: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      coef: {
        type: Sequelize.FLOAT(8, 4),
        allowNull: false,
        defaultValue: 1.0
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
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the table if migration needs to be rolled back
    await queryInterface.dropTable('currencies');
  }
};
