/** @format */

'use strict';
const { Model } = require('sequelize');
const constants = require('@helpers/constants.js');

module.exports = (sequelize, DataTypes) => {
  class PassengerTicket extends Model {
    static associate(models) {
      // Define associations here
      PassengerTicket.belongsTo(models.discount, {
        foreignKey: 'passengerDiscountId'
      });
      PassengerTicket.belongsTo(models.ticket, { foreignKey: 'ticketId' });
      PassengerTicket.belongsTo(models.passenger, {
        foreignKey: 'passengerId'
      });
      PassengerTicket.belongsTo(models.agent, { foreignKey: 'agentId' });
      PassengerTicket.belongsTo(models.ticketmeta, {
        as: 'confirmationMeta',
        foreignKey: 'confirmationId'
      });
    }
  }

  PassengerTicket.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        autoIncrement: true
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'agent',
          key: 'id'
        }
      },
      busSeat: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      discountCardNumber: {
        type: DataTypes.INTEGER(11),
        allowNull: true
      },
      note: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      passengerDiscountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'discount',
          key: 'id'
        }
      },
      passengerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'passenger',
          key: 'id'
        }
      },
      paymentAtOffice: {
        type: DataTypes.STRING,
        allowNull: true
      },
      paymentOnBus: {
        type: DataTypes.STRING,
        allowNull: true
      },
      paymentAtOfficeUAH: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Amount paid at office, in UAH (admin truth); paymentAtOffice = round(this / exchangeRate).'
      },
      paymentOnBusUAH: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Amount paid on bus, in UAH (admin truth); paymentOnBus = round(this / exchangeRate).'
      },
      discountPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
        comment:
          'Explicit discount percentage override; used for child passengers'
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Per-passenger calculated price; tickets.price is the sum of these.'
      },
      priceUAH: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Per-passenger price normalized to UAH; SUM == tickets.priceUAH.'
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'ticket',
          key: 'id'
        }
      },
      confirmationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'ticketmeta',
          key: 'id'
        },
        comment: 'Reference to confirmation status in ticketmeta table'
      },
      PDFFileName: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
        comment:
          'Filename (without .pdf extension) of the PDF generated for this individual passenger'
      }
    },
    {
      sequelize,
      modelName: 'passengerticket',
      tableName: 'passengertickets'
    }
  );

  return PassengerTicket;
};
