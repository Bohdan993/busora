'use strict';

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('tickets', 'dateOfCreature', {
      type: Sequelize.DATEONLY,
      allowNull: false,
      defaultValue: Sequelize.NOW,
      validate: {
        isDate: true
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('tickets', 'dateOfCreature');
  }
};
