'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('busflights', 'allSeats', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    });

    await queryInterface.changeColumn('busflights', 'freeSeats', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('busflights', 'allSeats', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('busflights', 'freeSeats', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  }
};
