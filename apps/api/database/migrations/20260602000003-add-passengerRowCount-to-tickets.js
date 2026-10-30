'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('tickets');
    if (!columns.passengerRowCount) {
      await queryInterface.addColumn('tickets', 'passengerRowCount', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment:
          'Cached count of all passengers (adults + children); kept in sync by DB triggers'
      });
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('tickets');
    if (columns.passengerRowCount) {
      await queryInterface.removeColumn('tickets', 'passengerRowCount');
    }
  }
};
