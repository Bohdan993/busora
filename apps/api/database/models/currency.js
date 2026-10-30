'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Currency extends Model {
    static associate(models) {
      // Define associations here
      Currency.hasMany(models.busflightprices);
      Currency.hasMany(models.city);
    }
  }

  Currency.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      abbr: {
        type: DataTypes.STRING(4),
        allowNull: false,
        unique: true
      },
      symbol: {
        type: DataTypes.STRING(3),
        allowNull: false,
        unique: true
      },
      isBaseCurrency: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      coef: {
        type: DataTypes.FLOAT(8, 4),
        allowNull: false,
        defaultValue: 1.0
      }
    },
    {
      sequelize,
      modelName: 'currency',
      tableName: 'currencies'
    }
  );

  return Currency;
};
