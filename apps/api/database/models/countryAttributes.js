'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CountryAttributes extends Model {
    static associate(models) {
      // Define associations here
      CountryAttributes.belongsTo(models.country, { foreignKey: 'countryId' });
      CountryAttributes.belongsTo(models.language, {
        foreignKey: 'languageId'
      });
    }
  }

  CountryAttributes.init(
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
      countryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'country',
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
      modelName: 'countryattributes',
      tableName: 'countryattributes'
    }
  );

  return CountryAttributes;
};
