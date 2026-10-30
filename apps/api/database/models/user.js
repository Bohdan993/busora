/** @format */

'use strict';
const { Model } = require('sequelize');
const constants = require('@helpers/constants.js');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Define associations here
      User.hasMany(models.token);
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(30),
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING(14),
        unique: true,
        allowNull: true
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        validate: {
          isEmail: true
        },
        allowNull: false
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      role: {
        type: DataTypes.ENUM,
        values: [
          constants.ADMIN_ROLE,
          constants.MANAGER_ROLE,
          constants.USER_ROLE
        ],
        defaultValue: constants.USER_ROLE,
        allowNull: false
      },
      isActivated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
      },
      isBlocked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
      },
      activationLink: {
        type: DataTypes.STRING,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'user',
      tableName: 'users'
    }
  );

  return User;
};
