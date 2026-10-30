'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PlaceAttributes extends Model {
    static associate(models) {
      // Define associations here
      PlaceAttributes.belongsTo(models.place, { foreignKey: 'placeId' });
      PlaceAttributes.belongsTo(models.language, { foreignKey: 'languageId' });
    }
  }

  PlaceAttributes.init(
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
      placeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'place',
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
      modelName: 'placeattributes',
      tableName: 'placeattributes'
    }
  );

  return PlaceAttributes;
};
