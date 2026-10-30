'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AgentAttributes extends Model {
    static associate(models) {
      // Define associations here
      AgentAttributes.belongsTo(models.agent, { foreignKey: 'agentId' });
      AgentAttributes.belongsTo(models.language, { foreignKey: 'languageId' });
    }
  }

  AgentAttributes.init(
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
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'agent',
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
      modelName: 'agentattributes',
      tableName: 'agentattributes'
    }
  );

  return AgentAttributes;
};
