'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BusFlightPrices extends Model {
    static associate(models) {
      // Define associations here
      BusFlightPrices.belongsTo(models.city, {
        foreignKey: 'firstCityId',
        as: 'firstbusflightcity'
      });
      BusFlightPrices.belongsTo(models.city, {
        foreignKey: 'secondCityId',
        as: 'secondbusflightcity'
      });
      BusFlightPrices.belongsTo(models.currency, { foreignKey: 'currencyId' });
    }
  }

  BusFlightPrices.init(
    {
      id: {
        type: DataTypes.INTEGER,
        unique: true,
        autoIncrement: true,
        primaryKey: true
      },
      priceOneWay: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      priceRoundTrip: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      firstCityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'city',
          key: 'id'
        }
      },
      secondCityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'city',
          key: 'id'
        }
      },
      currencyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'currency',
          key: 'id'
        }
      }
    },
    {
      sequelize,
      modelName: 'busflightprices',
      tableName: 'busflightprices'
    }
  );

  return BusFlightPrices;
};
