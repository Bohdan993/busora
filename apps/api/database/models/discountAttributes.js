'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DiscountAttributes extends Model {
    static associate(models) {
      // Define associations here
      DiscountAttributes.belongsTo(models.discount, {
        foreignKey: 'discountId'
      });
      DiscountAttributes.belongsTo(models.language, {
        foreignKey: 'languageId'
      });
    }
  }

  DiscountAttributes.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      discountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'discount',
          key: 'id'
        }
      },
      languageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'language',
          key: 'id'
        }
      }
    },
    {
      sequelize,
      modelName: 'discountattributes',
      tableName: 'discountattributes'
    }
  );

  return DiscountAttributes;
};
