'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Agent extends Model {
    static associate(models) {
      // Define associations here
      Agent.belongsToMany(models.language, { through: 'agentattributes' });
      Agent.hasMany(models.agentattributes, { as: 'agentattrs' });
      Agent.hasMany(models.passengerticket, { foreignKey: 'agentId' });
    }
  }

  Agent.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      }
    },
    {
      sequelize,
      modelName: 'agent',
      tableName: 'agents'
    }
  );

  return Agent;
};
