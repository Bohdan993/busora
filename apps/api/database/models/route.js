'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Route extends Model {
    static associate(models) {
      Route.belongsTo(models.country, { foreignKey: 'countryId' });
      Route.belongsToMany(models.language, { through: 'routeattributes' });
      Route.hasMany(models.busflight, {
        foreignKey: 'routeId',
        as: 'busFlightTo'
      });
      Route.hasMany(models.busflight, {
        foreignKey: 'routeId',
        as: 'busFlightFrom'
      });
      Route.hasMany(models.routeattributes, { as: 'routeattrs' });
    }
  }

  Route.init(
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
      routePath: {
        type: DataTypes.JSON,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'route',
      tableName: 'routes'
    }
  );

  return Route;
};
