/** @format */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TicketMeta extends Model {
    static associate(models) {
      // TicketMeta can be referenced by tickets and passenger tickets
      TicketMeta.hasMany(models.ticket, {
        foreignKey: 'statusId',
        as: 'ticketsWithStatus'
      });

      TicketMeta.hasMany(models.ticket, {
        foreignKey: 'typeId',
        as: 'ticketsWithType'
      });

      TicketMeta.hasMany(models.passengerticket, {
        foreignKey: 'confirmationId',
        as: 'passengerTicketsWithConfirmation'
      });

      TicketMeta.hasMany(models.ticketmetaattributes, {
        as: 'ticketmetaattrs',
        foreignKey: 'metaId'
      });
    }
  }

  TicketMeta.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      meta_key: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
        comment:
          "Unique identifier for the meta type (e.g., 'ticket_status_paid')"
      },
      meta_type: {
        type: DataTypes.ENUM(
          'ticket_status',
          'ticket_type',
          'confirmation_type'
        ),
        allowNull: false,
        comment: 'Category of the metadata (status, type, confirmation)'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this meta option is currently active'
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'For ordering options in UI'
      }
    },
    {
      sequelize,
      modelName: 'ticketmeta',
      tableName: 'ticketmeta'
    }
  );

  return TicketMeta;
};
