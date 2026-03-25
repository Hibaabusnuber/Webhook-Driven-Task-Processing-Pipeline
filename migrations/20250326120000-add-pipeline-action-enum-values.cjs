'use strict';

/** Adds new `pipelines.action_type` enum values for existing PostgreSQL databases. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const typeName = 'enum_pipelines_action_type';
    for (const value of ['keywords', 'hash', 'json_transform']) {
      await q.query(
        `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}';`
      );
    }
  },

  async down() {
    // PostgreSQL does not support dropping individual enum values safely.
  },
};
