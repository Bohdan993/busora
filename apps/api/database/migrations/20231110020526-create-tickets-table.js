/** @format */

'use strict';
const constants = require('@helpers/constants.js');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tickets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      dateOfDeparture: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        validate: {
          isDate: true
        }
      },
      dateOfReturn: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        validate: {
          isDate: true
        }
      },
      busFlightFromId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'busflights', // Make sure to use the actual table name for BusFlightModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      busFlightToId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'busflights', // Make sure to use the actual table name for BusFlightModel
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      price: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      currencyAbbr: {
        type: Sequelize.STRING(4),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM,
        values: [constants.ONE_WAY, constants.ROUND, constants.OPEN_DATE],
        allowNull: false
      },
      signature: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      status: {
        type: Sequelize.ENUM,
        values: [
          constants.TICKET_STATUS_NOT_PAYED,
          constants.TICKET_STATUS_PAYED,
          constants.TICKET_STATUS_HALF_USED,
          constants.TICKET_STATUS_USED
        ],
        defaultValue: constants.TICKET_STATUS_NOT_PAYED,
        allowNull: false
      },
      dateOfFirstUsage: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        validate: {
          isDate: true
        }
      },
      hasDiscount: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      discountPercentage: {
        type: Sequelize.FLOAT(3, 1),
        allowNull: false
      },
      originId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities', // Make sure to use the actual table name for CitiesModel (assuming it"s "cities")
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      destinationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities', // Make sure to use the actual table name for CitiesModel (assuming it"s "cities")
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      children: {
        type: Sequelize.JSON,
        allowNull: true
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
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the table if migration needs to be rolled back
    await queryInterface.dropTable('tickets');
  }
};
