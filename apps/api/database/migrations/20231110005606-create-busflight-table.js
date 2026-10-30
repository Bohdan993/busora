'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('busflights', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      allSeats: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      freeSeats: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      routeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'routes', // Make sure to use the actual table name for RoutesModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      dateOfDeparture: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        validate: {
          isDate: true
        }
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add any additional logic for associations or indexes here, if needed

    // Define associations
    // await queryInterface.addConstraint("busflights", {
    //   fields: ["routeId"],
    //   type: "foreign key",
    //   name: "fk_routeId",
    //   references: {
    //     table: "Route", // Make sure to use the actual table name for RoutesModel
    //     field: "id",
    //   },
    //   onDelete: "CASCADE",
    //   onUpdate: "CASCADE",
    // });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the table if migration needs to be rolled back
    await queryInterface.dropTable('busflights');
  }
};
