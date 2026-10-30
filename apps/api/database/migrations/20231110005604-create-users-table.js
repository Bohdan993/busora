/** @format */

'use strict';
const constants = require('@helpers/constants.js');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(14),
        unique: true,
        allowNull: true
      },
      dateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM,
        values: [
          constants.ADMIN_ROLE,
          constants.MANAGER_ROLE,
          constants.USER_ROLE
        ],
        defaultValue: constants.USER_ROLE,
        allowNull: false
      },
      isActivated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: true
      },
      activationLink: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable('users');
  }
};
