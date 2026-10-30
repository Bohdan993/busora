'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CityAttributes extends Model {
    static associate(models) {
      // Define associations here
      CityAttributes.belongsTo(models.city, { foreignKey: 'cityId' });
      CityAttributes.belongsTo(models.language, { foreignKey: 'languageId' });
    }
  }

  CityAttributes.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(30),
        allowNull: false
      },
      cityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'city',
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
      modelName: 'cityattributes',
      tableName: 'cityattributes'
    }
  );

  return CityAttributes;
};
