const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, "departureDateTime", "arrivalDateTime", "busId"
    FROM "Schedule"
    WHERE "routeId" = '46476ae8-baf3-4dc1-b42c-0aefe716daaf'
  `);
  console.log('Schedules:', res.rows);

  const tRes = await client.query(`
    SELECT *
    FROM "ScheduleTemplate"
    WHERE "routeId" = '46476ae8-baf3-4dc1-b42c-0aefe716daaf'
  `);
  console.log('Templates:', tRes.rows);

  await client.end();
}

run().catch(console.error);
