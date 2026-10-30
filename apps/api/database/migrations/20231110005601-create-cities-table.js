'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cities', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true,
        allowNull: false
      },
      countryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'countries', // Make sure to use the actual table name for CountriesModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      currencyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'currencies', // Make sure to use the actual table name for CurrencyModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('cities');
  }
};
