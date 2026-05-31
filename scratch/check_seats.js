const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(`
      SELECT 
        s.id, 
        s.status, 
        s."availableSeats", 
        b.capacity,
        b."licensePlate"
      FROM "Schedule" s
      JOIN "Bus" b ON s."busId" = b.id
      WHERE s."companyId" = 'bd422b92-7824-4337-9afc-3960b7da3a1a'
    `);
    console.log('Schedules with Bus Capacity:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
