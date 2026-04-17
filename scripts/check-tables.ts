// scripts/check-tables.ts
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function check(): Promise<void> {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables found:', res.rows.map(r => r.table_name));
  await client.end();
}

check().catch(console.error);

export {};
