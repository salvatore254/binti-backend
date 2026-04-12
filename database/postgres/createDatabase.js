require('dotenv').config({ override: true });

const { Client } = require('pg');

const databaseName = process.env.PGDATABASE || 'binti_events';

const run = async () => {
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

    if (existing.rowCount > 0) {
      console.log('database-already-exists');
      return;
    }

    await client.query(`CREATE DATABASE ${databaseName}`);
    console.log('database-created');
  } finally {
    await client.end().catch(() => {});
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});