require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const sql = fs.readFileSync('scratch/diff_update.sql', 'utf8');
  console.log('Applying migration to production DB...');
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('✅ Migration applied cleanly to production DB.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('🚨 Migration failed:', err.message);
    if (err.detail) console.error('Details:', err.detail);
    if (err.position) console.error('Position:', err.position);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
