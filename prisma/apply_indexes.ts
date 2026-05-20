import { Pool } from 'pg';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in environment variables.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const sqlPath = path.join(__dirname, 'indexes.sql');
  console.log(`Reading SQL commands from ${sqlPath}...`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Strip SQL single line comments
  const cleanSql = sql.replace(/--.*$/gm, '');

  // Split SQL commands by semicolon
  const commands = cleanSql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0);

  console.log(`Connecting to database and executing ${commands.length} SQL commands...`);

  const client = await pool.connect();
  try {
    for (const cmd of commands) {
      console.log(`Executing: ${cmd}`);
      await client.query(cmd);
    }
    console.log('Successfully applied all indexes to the database!');
  } catch (error) {
    console.error('Error applying indexes:', error);
  } finally {
    client.release();
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
