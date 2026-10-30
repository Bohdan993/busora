'use strict';

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new column to the existing table
    await queryInterface.addColumn('tickets', 'ticketNumber', {
      type: Sequelize.STRING(6),
      allowNull: true
    });

    const startTicketId = 100;

    // 2. Update "ticketNumber" based on "id", using zero-padding logic (MySQL compatible)
    await queryInterface.sequelize.query(`
      UPDATE tickets
      SET ticketNumber = 
        LPAD(CAST((id + ${startTicketId}) AS CHAR), 6, "0");
    `);

    // 3. Change the "ticketNumber" column to NOT NULL after populating the values
    await queryInterface.changeColumn('tickets', 'ticketNumber', {
      type: Sequelize.STRING(6),
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added column in case of rollback
    await queryInterface.removeColumn('tickets', 'ticketNumber');
  }
};
