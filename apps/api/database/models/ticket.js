/** @format */

'use strict';
const { Model } = require('sequelize');
const constants = require('@helpers/constants.js');

module.exports = (sequelize, DataTypes) => {
  class Ticket extends Model {
    static associate(models) {
      // Define associations here
      Ticket.belongsTo(models.busflight, {
        as: 'busFlightFrom',
        foreignKey: 'busFlightFromId'
      });
      Ticket.belongsTo(models.busflight, {
        as: 'busFlightTo',
        foreignKey: 'busFlightToId'
      });
      Ticket.belongsTo(models.city, {
        as: 'originCity',
        foreignKey: 'originId'
      });
      Ticket.belongsTo(models.city, {
        as: 'destinationCity',
        foreignKey: 'destinationId'
      });

      // TicketMeta associations for status and type
      Ticket.belongsTo(models.ticketmeta, {
        as: 'statusMeta',
        foreignKey: 'statusId'
      });
      Ticket.belongsTo(models.ticketmeta, {
        as: 'typeMeta',
        foreignKey: 'typeId'
      });
      Ticket.belongsToMany(models.passenger, { through: 'passengerticket' });
      Ticket.hasMany(models.passengerticket);
    }
  }

  Ticket.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      dateOfDeparture: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: true
        }
      },
      dateOfReturn: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: true
        }
      },
      dateOfCreature: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: true
        }
      },
      busFlightFromId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'busflight',
          key: 'id'
        }
      },
      busFlightToId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'busflight',
          key: 'id'
        }
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      currencyAbbr: {
        type: DataTypes.STRING(4),
        allowNull: false
      },
      exchangeRate: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        defaultValue: null,
        comment: 'UAH per 1 unit of currencyAbbr at booking time; 1 for UAH.'
      },
      priceUAH: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Ticket total normalized to UAH (price × exchangeRate), locked at booking.'
      },
      signature: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4
      },
      dateOfFirstUsage: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: true
        }
      },
      hasDiscount: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      discountPercentage: {
        type: DataTypes.FLOAT(3, 1),
        allowNull: false
      },
      originId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'city',
          key: 'id'
        }
      },
      destinationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'city',
          key: 'id'
        }
      },
      children: {
        type: DataTypes.JSON,
        allowNull: true
      },
      PDFFileName: {
        type: DataTypes.STRING(64),
        unique: true,
        allowNull: true
      },
      prevPDFFileName: {
        type: DataTypes.STRING(64),
        unique: true,
        allowNull: true
      },
      transactionId: {
        type: DataTypes.STRING(36),
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false
      },
      ticketNumber: {
        type: DataTypes.STRING(6),
        defaultValue: false,
        allowNull: false
      },
      statusId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'ticketmeta',
          key: 'id'
        },
        comment: 'Reference to ticket status in ticketmeta table'
      },
      typeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'ticketmeta',
          key: 'id'
        },
        comment: 'Reference to ticket type in ticketmeta table'
      },
      passengerRowCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment:
          'Cached count of all passengers (adults + children); kept in sync by DB triggers'
      }
    },
    {
      sequelize,
      modelName: 'ticket',
      tableName: 'tickets'
    }
  );

  Ticket.afterCreate(async (ticket, options) => {
    let ticketNumber = Number(ticket.id) + constants.STARTER_TICKET_ID;

    while (String(ticketNumber).length < 6) {
      ticketNumber = '0' + ticketNumber;
    }

    // Run this UPDATE on the SAME transaction as the triggering create. When
    // Ticket.create runs inside a transaction, the just-inserted row is locked
    // by it; issuing this UPDATE on a separate connection (no transaction) makes
    // it wait for that lock while the transaction waits for this hook to finish
    // — a self-deadlock that surfaces as "Lock wait timeout exceeded". Passing
    // options.transaction keeps it on the same connection (and is a no-op when
    // there is no transaction).
    await Ticket.update(
      {
        ticketNumber: ticketNumber
      },
      {
        where: {
          id: ticket.id
        },
        transaction: options.transaction
      }
    );
  });

  return Ticket;
};
