/**
 * Creates the database named in DATABASE_URL (path segment) if it does not exist.
 * Connects to the built-in `postgres` database to run CREATE DATABASE.
 */
'use strict';

require('dotenv').config();
const { Client } = require('pg');

const fallback = 'postgres://postgres:postgres@127.0.0.1:5432/pipeline';

function parseTarget(urlString) {
  const u = new URL(urlString);
  const dbName = (u.pathname || '').replace(/^\//, '').split('/')[0];
  if (!dbName) {
    throw new Error('DATABASE_URL must include a database name in the path, e.g. ...5432/pipeline');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsafe database name "${dbName}" — use only letters, numbers, underscore.`);
  }
  u.pathname = '/postgres';
  return { adminUrl: u.toString(), dbName };
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

async function main() {
  const urlString = process.env.DATABASE_URL || fallback;
  const { adminUrl, dbName } = parseTarget(urlString);

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const check = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (check.rowCount > 0) {
      console.log(`Database "${dbName}" already exists. Nothing to do.`);
      return;
    }
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    console.log(`Created database "${dbName}".`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
