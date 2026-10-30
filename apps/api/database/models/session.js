'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    static associate(models) {
      // Define associations here
    }
  }

  Session.init(
    {
      id: {
        type: DataTypes.INTEGER,
        unique: true,
        autoIncrement: true,
        primaryKey: true
      },
      signature: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      sessionInfo: {
        type: DataTypes.JSON,
        allowNull: false
      },
      expires: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'session',
      tableName: 'sessions'
    }
  );

  return Session;
};
