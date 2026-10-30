'use strict';

/**
 * Adds a per-passenger PDFFileName column to the passengertickets table.
 *
 * Previously, one PDF was generated for the entire ticket (all passengers combined)
 * and its filename was stored on the tickets table. This migration enables storing
 * a separate PDF filename for each adult passenger row.
 *
 * Children are still stored as a JSON blob in tickets.children, so their individual
 * PDF filenames will be added as a property inside that JSON object — no extra
 * column is needed for them here.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('passengertickets', 'PDFFileName', {
      type: Sequelize.STRING(64),
      allowNull: true,
      defaultValue: null,
      comment:
        'Filename (without .pdf extension) of the PDF generated for this individual passenger'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('passengertickets', 'PDFFileName');
  }
};
