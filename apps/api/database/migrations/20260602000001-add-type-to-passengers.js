'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('passengers');

    if (!columns.type) {
      await queryInterface.addColumn('passengers', 'type', {
        type: Sequelize.ENUM('adult', 'child'),
        allowNull: false,
        defaultValue: 'adult'
      });
    }

    if (columns.phone && columns.phone.allowNull === false) {
      await queryInterface.changeColumn('passengers', 'phone', {
        type: Sequelize.STRING(14),
        allowNull: true
      });
    }

    if (columns.dateOfBirth && columns.dateOfBirth.allowNull === false) {
      await queryInterface.changeColumn('passengers', 'dateOfBirth', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('passengers', 'dateOfBirth', {
      type: Sequelize.DATEONLY,
      allowNull: false
    });
    await queryInterface.changeColumn('passengers', 'phone', {
      type: Sequelize.STRING(14),
      allowNull: false
    });
    const columns = await queryInterface.describeTable('passengers');
    if (columns.type) {
      await queryInterface.removeColumn('passengers', 'type');
    }
  }
};
