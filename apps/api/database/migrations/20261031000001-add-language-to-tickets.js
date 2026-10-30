/** @format */

'use strict';

// The language the customer booked in. Ticket PDFs and emails are rendered in
// it — including later re-generation from the admin panel. Existing tickets
// default to Ukrainian (languageId 1).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tickets', 'languageId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: { model: 'languages', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Booking language; PDFs and emails are rendered in it'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tickets', 'languageId');
  }
};
