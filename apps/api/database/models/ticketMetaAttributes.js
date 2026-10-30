/** @format */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TicketMetaAttributes extends Model {
    static associate(models) {
      TicketMetaAttributes.belongsTo(models.ticketmeta, {
        foreignKey: 'metaId'
      });
      TicketMetaAttributes.belongsTo(models.language, {
        foreignKey: 'languageId'
      });
    }
  }
  TicketMetaAttributes.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      metaId: {
        type: DataTypes.INTEGER,
        references: {
          model: 'ticketmeta',
          key: 'id'
        },
        allowNull: false
      },
      languageId: {
        type: DataTypes.INTEGER,
        references: {
          model: 'languages',
          key: 'id'
        },
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Localized display name for the meta value'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional detailed description in the specified language'
      }
    },
    {
      sequelize,
      modelName: 'ticketmetaattributes',
      tableName: 'ticketmetaattributes'
    }
  );

  return TicketMetaAttributes;
};
