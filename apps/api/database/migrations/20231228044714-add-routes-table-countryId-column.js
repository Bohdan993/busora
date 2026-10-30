'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('routes', 'countryId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'countries', // Replace with the actual name of the referenced table
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('routes', 'countryId');
  }
};
