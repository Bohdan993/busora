'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class City extends Model {
    static associate(models) {
      // Define associations here
      City.belongsTo(models.country, { foreignKey: 'countryId' });
      City.belongsTo(models.currency, { foreignKey: 'currencyId' });
      City.belongsToMany(models.language, { through: 'cityattributes' });
      City.hasMany(models.busflightprices, {
        as: 'firstbusflightcity',
        foreignKey: 'firstCityId'
      });
      City.hasMany(models.busflightprices, {
        as: 'secondbusflightcity',
        foreignKey: 'secondCityId'
      });
      City.hasMany(models.cityattributes, { as: 'cityattrs' });
      City.hasMany(models.ticket, { as: 'originCity', foreignKey: 'originId' });
      City.hasMany(models.ticket, {
        as: 'destinationCity',
        foreignKey: 'destinationId'
      });
      City.hasMany(models.place);
    }
  }

  City.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      countryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'country',
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
      modelName: 'city',
      tableName: 'cities'
    }
  );

  return City;
};
