'use strict';
const { Model } = require('sequelize');

/**
 * Canonical ordering of cities along each bus-line direction, used to sort the
 * admin city list. One row = a city's position within one direction (routeKey)
 * of one line (lineGroup). This lives in the DB so the order can be maintained
 * without code changes.
 */
module.exports = (sequelize, DataTypes) => {
  class RouteCityOrder extends Model {}

  RouteCityOrder.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      lineGroup: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment:
          'Groups the forward/reverse directions of one bus line for the response shape.'
      },
      routeKey: {
        type: DataTypes.STRING(8),
        allowNull: false,
        comment: 'Direction label exposed to the client (e.g. ZD, DZ, ZK, KZ).'
      },
      cityId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '0-based stop index of the city within this route direction.'
      }
    },
    {
      sequelize,
      modelName: 'routecityorder',
      tableName: 'routecityorders'
    }
  );

  return RouteCityOrder;
};
