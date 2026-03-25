'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Idempotent: syncModels() may already add this column before migrations run.
    await queryInterface.sequelize.query(`
      ALTER TABLE subscribers
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE subscribers
      DROP COLUMN IF EXISTS deleted_at;
    `);
  },
};
