'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('passengertickets', 'paymentOnBus', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('passengertickets', 'paymentOnBus');
  }
};
