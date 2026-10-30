'use strict';

module.exports = {
  up: async (queryInterface) => {
    const dialect = queryInterface.sequelize.options.dialect;

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION fn_increment_passenger_row_count()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE tickets SET "passengerRowCount" = "passengerRowCount" + 1 WHERE id = NEW."ticketId";
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER pt_after_insert
        AFTER INSERT ON passengertickets
        FOR EACH ROW EXECUTE FUNCTION fn_increment_passenger_row_count();
      `);

      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION fn_decrement_passenger_row_count()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE tickets SET "passengerRowCount" = "passengerRowCount" - 1 WHERE id = OLD."ticketId";
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER pt_after_delete
        AFTER DELETE ON passengertickets
        FOR EACH ROW EXECUTE FUNCTION fn_decrement_passenger_row_count();
      `);
    } else {
      await queryInterface.sequelize.query(`
        CREATE TRIGGER pt_after_insert
        AFTER INSERT ON passengertickets
        FOR EACH ROW
        UPDATE tickets SET passengerRowCount = passengerRowCount + 1 WHERE id = NEW.ticketId;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER pt_after_delete
        AFTER DELETE ON passengertickets
        FOR EACH ROW
        UPDATE tickets SET passengerRowCount = passengerRowCount - 1 WHERE id = OLD.ticketId;
      `);
    }
  },

  down: async (queryInterface) => {
    const dialect = queryInterface.sequelize.options.dialect;

    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS pt_after_insert ON passengertickets'
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS pt_after_delete ON passengertickets'
    );

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS fn_increment_passenger_row_count'
      );
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS fn_decrement_passenger_row_count'
      );
    }
  }
};
