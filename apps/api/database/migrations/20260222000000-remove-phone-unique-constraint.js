'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the unique constraint from phone field
    await queryInterface.changeColumn('passengers', 'phone', {
      type: Sequelize.STRING(14),
      allowNull: false,
      unique: false // Remove unique constraint
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Restore the unique constraint if rolling back
    // Note: This will fail if there are duplicate phone numbers in the database
    await queryInterface.changeColumn('passengers', 'phone', {
      type: Sequelize.STRING(14),
      allowNull: false,
      unique: true
    });
  }
};
