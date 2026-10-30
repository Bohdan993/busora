/** @format */

'use strict';
const constants = require('@helpers/constants.js');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('passengertickets', 'confirmation', {
      type: Sequelize.ENUM,
      values: [
        constants.CONFIRMATION,
        constants.DATE_TRANSFER,
        constants.REFUSAL
      ],
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('passengertickets', 'confirmation');
  }
};
