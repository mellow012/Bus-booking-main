const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query('SELECT id, name, status FROM "Company"');
    console.log('Companies:', res.rows);

    const res2 = await pool.query('SELECT id, status, "isArchived", "availableSeats", "departureDateTime" FROM "Schedule" WHERE "companyId" = \'bd422b92-7824-4337-9afc-3960b7da3a1a\'');
    console.log('Schedules for SOSOSO:', res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
