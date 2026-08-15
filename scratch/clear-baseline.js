require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query('DELETE FROM "_prisma_migrations" WHERE migration_name = \'0_baseline_migration\'');
  console.log('Successfully cleared baseline migration record.');
}

main()
  .catch(console.error)
  .finally(() => pool.end());
