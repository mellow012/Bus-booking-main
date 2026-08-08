const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, origin, destination 
    FROM "Route" 
    WHERE origin ILIKE '%Lilongwe%' AND destination ILIKE '%Salima%'
  `);
  console.log('Routes:', res.rows);

  for (const route of res.rows) {
    const sRes = await client.query(`
      SELECT id, status, "tripStatus", "departureDateTime", "departureTimeZone", "isActive", "isArchived", "isCompleted"
      FROM "Schedule"
      WHERE "routeId" = $1
    `, [route.id]);
    console.log(`Schedules for route ${route.id}:`, sRes.rows);
  }

  await client.end();
}

run().catch(console.error);
