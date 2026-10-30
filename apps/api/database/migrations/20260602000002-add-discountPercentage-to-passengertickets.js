'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('passengertickets');
    if (!columns.discountPercentage) {
      await queryInterface.addColumn('passengertickets', 'discountPercentage', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
        comment:
          'Explicit discount percentage override; used for child passengers'
      });
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('passengertickets');
    if (columns.discountPercentage) {
      await queryInterface.removeColumn(
        'passengertickets',
        'discountPercentage'
      );
    }
  }
};
