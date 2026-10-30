/** @format */

'use strict';
const { Model } = require('sequelize');
const constants = require('@helpers/constants.js');

module.exports = (sequelize, DataTypes) => {
  class Discount extends Model {
    static associate(models) {
      // Define associations here
      Discount.belongsTo(models.busflight);
      Discount.belongsToMany(models.language, {
        through: 'discountattributes'
      });
      Discount.hasMany(models.discountattributes, { as: 'discountattrs' });
      Discount.hasMany(models.passengerticket, {
        foreignKey: 'passengerDiscountId'
      });
    }
  }

  Discount.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      coef: {
        type: DataTypes.FLOAT(3, 2),
        allowNull: false
      },
      group: {
        type: DataTypes.ENUM,
        values: [
          constants.ADULTS,
          constants.CHILDREN,
          constants.BOTH,
          constants.BUS_FLIGHT,
          constants.DISCOUNT_CARD
        ],
        defaultValue: constants.ADULTS,
        allowNull: false
      },
      inactivePeriod: {
        type: DataTypes.STRING(11),
        allowNull: true
      },
      maxAge: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      minAge: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 500
      },
      busFlightId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'busflights', // Make sure to use the actual table name for BusFlightModel
          key: 'id'
        }
      }
    },
    {
      sequelize,
      modelName: 'discount',
      tableName: 'discounts'
    }
  );

  return Discount;
};
