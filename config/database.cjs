/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();

const url =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/pipeline';

module.exports = {
  development: { url, dialect: 'postgres', dialectOptions: {} },
  test: { url, dialect: 'postgres', dialectOptions: {} },
  production: { url, dialect: 'postgres', dialectOptions: {} },
};
