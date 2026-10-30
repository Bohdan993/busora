'use strict';

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('tickets', 'transactionId', {
      type: Sequelize.STRING(36),
      defaultValue: Sequelize.UUIDV4,
      unique: true,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('tickets', 'transactionId');
  }
};
