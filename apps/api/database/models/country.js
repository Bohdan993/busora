'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Country extends Model {
    static associate(models) {
      // Define associations here
      Country.belongsToMany(models.language, { through: 'countryattributes' });
      Country.hasMany(models.city);
      Country.hasMany(models.countryattributes, { as: 'countryattrs' });
      Country.hasMany(models.route);
    }
  }

  Country.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      }
    },
    {
      sequelize,
      modelName: 'country',
      tableName: 'countries'
    }
  );

  return Country;
};
