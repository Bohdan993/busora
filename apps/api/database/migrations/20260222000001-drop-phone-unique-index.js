'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Drop the unique index on phone field
      await queryInterface.removeIndex('passengers', 'phone');
    } catch (error) {
      // If the index name is different, try common MySQL unique key names
      try {
        await queryInterface.sequelize.query(
          'ALTER TABLE `passengers` DROP INDEX `phone`'
        );
      } catch (err) {
        console.log(
          "Could not drop index 'phone', trying alternative names..."
        );
        try {
          // Try dropping by constraint name
          await queryInterface.sequelize.query(
            'ALTER TABLE `passengers` DROP KEY `phone`'
          );
        } catch (err2) {
          console.error('Error removing unique constraint:', err2.message);
          throw err2;
        }
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Restore the unique index if rolling back
    // Note: This will fail if there are duplicate phone numbers in the database
    await queryInterface.addIndex('passengers', ['phone'], {
      unique: true,
      name: 'phone'
    });
  }
};
