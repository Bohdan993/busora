'use strict';

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('users', 'isBlocked', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('users', 'isBlocked');
  }
};
