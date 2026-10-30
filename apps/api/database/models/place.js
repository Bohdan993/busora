'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Place extends Model {
    static associate(models) {
      // Define associations here
      Place.belongsTo(models.city, { foreignKey: 'cityId' });
      Place.belongsToMany(models.language, { through: 'placeattributes' });
      Place.hasMany(models.placeattributes, { as: 'placeattrs' });
    }
  }

  Place.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      cityId: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'place',
      tableName: 'places'
    }
  );

  return Place;
};
