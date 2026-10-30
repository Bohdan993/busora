'use strict';

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('tickets', 'prevPDFFileName', {
      type: Sequelize.STRING(64),
      unique: true,
      allowNull: true
    });

    await queryInterface.addColumn('tickets', 'PDFFileName', {
      type: Sequelize.STRING(64),
      unique: true,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('tickets', 'prevPDFFileName');
    await queryInterface.removeColumn('tickets', 'PDFFileName');
  }
};
