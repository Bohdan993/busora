'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Language extends Model {
    static associate(models) {
      // Define associations here
      Language.belongsToMany(models.city, { through: 'cityattributes' });
      Language.belongsToMany(models.country, { through: 'countryattributes' });
      Language.belongsToMany(models.discount, {
        through: 'discountattributes'
      });
      Language.belongsToMany(models.place, { through: 'placeattributes' });
      Language.belongsToMany(models.route, { through: 'routeattributes' });
      Language.belongsToMany(models.agent, { through: 'agentattributes' });
      Language.hasMany(models.cityattributes, { as: 'cityattrs' });
      Language.hasMany(models.countryattributes, { as: 'countryattrs' });
      Language.hasMany(models.discountattributes, { as: 'discountattrs' });
      Language.hasMany(models.placeattributes, { as: 'placeattrs' });
      Language.hasMany(models.routeattributes, { as: 'routeattrs' });
      Language.hasMany(models.agentattributes, { as: 'agentattrs' });
    }
  }

  Language.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true
      },
      code: {
        type: DataTypes.STRING(8),
        allowNull: false,
        unique: true
      }
    },
    {
      sequelize,
      modelName: 'language',
      tableName: 'languages'
    }
  );

  return Language;
};
