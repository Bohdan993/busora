'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cityattributes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      cityId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities', // Make sure to use the actual table name for CityModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      languageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'languages', // Make sure to use the actual table name for LanguagesModel
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
    await queryInterface.dropTable('cityattributes');
  }
};
