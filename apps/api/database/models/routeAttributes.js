'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RouteAttributes extends Model {
    static associate(models) {
      // Define associations here
      RouteAttributes.belongsTo(models.route, { foreignKey: 'routeId' });
      RouteAttributes.belongsTo(models.language, { foreignKey: 'languageId' });
    }
  }

  RouteAttributes.init(
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
      routeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'route',
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
      modelName: 'routeattributes',
      tableName: 'routeattributes'
    }
  );

  return RouteAttributes;
};
